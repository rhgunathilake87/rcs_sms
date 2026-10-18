// Seeds the local emulators with a demo bank and a demo admin login.
// Usage (while the emulators are running): npm run seed
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
process.env.GCLOUD_PROJECT ??= "demo-verified-sms";

const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp({ projectId: process.env.GCLOUD_PROJECT });

const INSTITUTION_ID = "demo-bank";
const ADMIN_EMAIL = "admin@demobank.lk";
const ADMIN_PASSWORD = "demo1234";

async function main() {
  const db = getFirestore();
  const auth = getAuth();

  await db.collection("institutions").doc(INSTITUTION_ID).set(
    {
      name: "Demo Bank PLC",
      logoUrl: "",
      senderId: "DEMOBANK",
      verified: true,
    },
    { merge: true }
  );
  console.log(`Seeded institutions/${INSTITUTION_ID}`);

  let user;
  try {
    user = await auth.getUserByEmail(ADMIN_EMAIL);
  } catch {
    user = await auth.createUser({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, displayName: "Demo Admin" });
  }
  await db.collection("admins").doc(user.uid).set({ email: ADMIN_EMAIL, institutionId: INSTITUTION_ID });
  console.log(`Seeded admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
