const admin = require('firebase-admin');
const { getDataConnect } = require('firebase-admin/data-connect');
const env = require('../env');

if (!admin.apps.length) {
  if (env.firebaseServiceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(env.firebaseServiceAccount),
      projectId: env.projectId,
    });
  } else if (env.nodeEnv !== 'production') {
    // local dev only: falls back to GOOGLE_APPLICATION_CREDENTIALS
    admin.initializeApp({ projectId: env.projectId });
  } else {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is missing');
  }
}

const dataConnect = getDataConnect({
  location: env.dcLocation,
  serviceId: env.dcServiceId,
  connector: 'default',
});

module.exports = { admin, dataConnect };