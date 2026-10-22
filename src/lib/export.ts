import { promises as fs } from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import type { CoursePackage } from "../../../player/src/format";
import { db } from "./db";
import { extOf, mediaPath, mediaUrlPattern } from "./media";

export const exportFormats = ["scorm12", "scorm2004", "xapi", "html"] as const;
export type ExportFormat = (typeof exportFormats)[number];

const playerDir = () => path.join(process.cwd(), "public", "player");

export class PlayerNotBuiltError extends Error {}

async function listFiles(dir: string, base = dir): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((e) => {
      const full = path.join(dir, e.name);
      return e.isDirectory() ? listFiles(full, base) : [path.relative(base, full).split(path.sep).join("/")];
    }),
  );
  return nested.flat();
}

const xml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "course";

export const activityId = (courseId: string) => `https://learnforge.local/courses/${courseId}`;

function scorm12Manifest(pkg: CoursePackage, files: string[]) {
  const title = xml(pkg.title);
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="LF-${pkg.id}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="ORG-1">
    <organization identifier="ORG-1">
      <title>${title}</title>
      <item identifier="ITEM-1" identifierref="RES-1" isvisible="true">
        <title>${title}</title>
        <adlcp:masteryscore>${pkg.settings.passingScore}</adlcp:masteryscore>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-1" type="webcontent" adlcp:scormtype="sco" href="index.html">
${files.map((f) => `      <file href="${xml(f)}"/>`).join("\n")}
    </resource>
  </resources>
</manifest>
`;
}

function scorm2004Manifest(pkg: CoursePackage, files: string[]) {
  const title = xml(pkg.title);
  const passing = (pkg.settings.passingScore / 100).toFixed(2);
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="LF-${pkg.id}" version="1.0"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"
  xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3"
  xmlns:imsss="http://www.imsglobal.org/xsd/imsss"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd http://www.adlnet.org/xsd/adlcp_v1p3 adlcp_v1p3.xsd http://www.adlnet.org/xsd/adlseq_v1p3 adlseq_v1p3.xsd http://www.adlnet.org/xsd/adlnav_v1p3 adlnav_v1p3.xsd http://www.imsglobal.org/xsd/imsss imsss_v1p0.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 4th Edition</schemaversion>
  </metadata>
  <organizations default="ORG-1">
    <organization identifier="ORG-1">
      <title>${title}</title>
      <item identifier="ITEM-1" identifierref="RES-1" isvisible="true">
        <title>${title}</title>
        <imsss:sequencing>
          <imsss:objectives>
            <imsss:primaryObjective objectiveID="PRIMARYOBJ" satisfiedByMeasure="true">
              <imsss:minNormalizedMeasure>${passing}</imsss:minNormalizedMeasure>
            </imsss:primaryObjective>
          </imsss:objectives>
        </imsss:sequencing>
      </item>
      <imsss:sequencing>
        <imsss:controlMode choice="true" flow="true"/>
      </imsss:sequencing>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-1" type="webcontent" adlcp:scormType="sco" href="index.html">
${files.map((f) => `      <file href="${xml(f)}"/>`).join("\n")}
    </resource>
  </resources>
</manifest>
`;
}

function tincanXml(pkg: CoursePackage) {
  return `<?xml version="1.0" encoding="utf-8" ?>
<tincan xmlns="http://projecttincan.com/tincan.xsd">
  <activities>
    <activity id="${xml(activityId(pkg.id))}" type="http://adlnet.gov/expapi/activities/course">
      <name lang="${xml(pkg.language)}">${xml(pkg.title)}</name>
      <description lang="${xml(pkg.language)}">${xml(pkg.description)}</description>
      <launch lang="${xml(pkg.language)}">index.html</launch>
    </activity>
  </activities>
</tincan>
`;
}

const trackingFor: Record<ExportFormat, string> = {
  scorm12: "scorm12",
  scorm2004: "scorm2004",
  xapi: "xapi",
  html: "none",
};

/**
 * Copy uploaded media referenced by the package (block urls, <img src> in html, section images)
 * into the zip under media/, and rewrite those references to the relative package paths.
 * Only assets owned by `ownerId` are bundled; other references are left untouched.
 */
async function bundleMedia(zip: JSZip, pkg: CoursePackage, ownerId: string) {
  const json = JSON.stringify(pkg);
  const ids = [...new Set([...json.matchAll(mediaUrlPattern)].map((m) => m[1]))];
  if (ids.length === 0) return { pkg, files: [] as string[] };

  const assets = await db.mediaAsset.findMany({ where: { id: { in: ids }, ownerId } });
  const local = new Map<string, string>();
  for (const a of assets) {
    const file = `media/${a.id}.${extOf(a.storageKey)}`;
    try {
      zip.file(file, await fs.readFile(mediaPath(a.storageKey)));
      local.set(a.id, file);
    } catch {
      /* file missing on disk: leave the reference as-is */
    }
  }
  const rewritten = json.replace(mediaUrlPattern, (match, id: string) => local.get(id) ?? match);
  return { pkg: JSON.parse(rewritten) as CoursePackage, files: [...local.values()] };
}

/** Bundle the built player + course data into a zip for the requested format. */
export async function buildExportZip(source: CoursePackage, format: ExportFormat, ownerId?: string) {
  const dir = playerDir();
  const playerFiles = await listFiles(dir).catch(() => {
    throw new PlayerNotBuiltError();
  });
  if (!playerFiles.includes("index.html")) throw new PlayerNotBuiltError();

  const zip = new JSZip();
  for (const f of playerFiles) zip.file(f, await fs.readFile(path.join(dir, f)));

  const { pkg, files: mediaFiles } = ownerId ? await bundleMedia(zip, source, ownerId) : { pkg: source, files: [] };

  const config: Record<string, unknown> = { tracking: trackingFor[format] };
  if (format === "xapi") config.activityId = activityId(pkg.id);
  zip.file("course.js", `window.LF_COURSE = ${JSON.stringify(pkg)};\n`);
  zip.file("lf-config.js", `window.LF_CONFIG = ${JSON.stringify(config)};\n`);

  // the player build ships placeholder course.js / lf-config.js, overwritten above
  const contentFiles = [...new Set([...playerFiles, ...mediaFiles, "course.js", "lf-config.js"])].sort();
  if (format === "scorm12") zip.file("imsmanifest.xml", scorm12Manifest(pkg, contentFiles));
  if (format === "scorm2004") zip.file("imsmanifest.xml", scorm2004Manifest(pkg, contentFiles));
  if (format === "xapi") zip.file("tincan.xml", tincanXml(pkg));

  const buffer = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return { buffer, filename: `${slugify(pkg.title)}-${format}.zip` };
}
