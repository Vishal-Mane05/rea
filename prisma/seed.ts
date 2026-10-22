import { hashPassword } from "../src/lib/auth";
import { db } from "../src/lib/db";
import { createCourseFromTemplate } from "../src/lib/templates";

const DEMO_EMAIL = "author@learnforge.local";
const DEMO_PASSWORD = "learnforge";

async function main() {
  const user = await db.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: { email: DEMO_EMAIL, name: "Demo Author" },
  });
  if (!user.passwordHash) {
    await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(DEMO_PASSWORD) } });
    console.log(`Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  }
  const existing = await db.course.count({ where: { ownerId: user.id } });
  if (existing === 0) {
    const course = await createCourseFromTemplate(user.id, "compliance");
    console.log(`Seeded course ${course.id} (${course.title})`);
  } else {
    console.log(`User already has ${existing} course(s); nothing to seed.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
