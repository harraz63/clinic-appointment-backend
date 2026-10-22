import admin from 'firebase-admin';
import { ServiceAccount } from 'firebase-admin';
import serviceAccountJson from './admin-sdk.json' with { type: 'json' };
// import { ObjectId } from 'mongoose';

const serviceAccount = serviceAccountJson as ServiceAccount;

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

// export async function sendNotification(userId: ObjectId, message: string):Promise<void> {
//     // // Fetch FCM tokens for the user
//     // const userFcms = await Fcm.find({ user: userId });
//     // const fcmTokens = userFcms.map(fcm => fcm.fcm);

//     // if (fcmTokens.length === 0) {
//     //     winston.warn(`No FCM tokens found for user: ${userId}`);
//     //     return { message: 'No FCM tokens found', success: false };
//     // }

//     // try {
//     //     const payload = {
//     //         notification: {
//     //             title: message.title,
//     //             body: message.body,
//     //         },
//     //         tokens: fcmTokens,
//     //     };

//     //     const response = await admin.messaging().sendEachForMulticast(payload);

//     //     const invalidTokens = [];
//     //     response.responses.forEach((res, index) => {
//     //         if (!res.success) {
//     //             if (res.error.code === 'messaging/registration-token-not-registered') {
//     //                 invalidTokens.push(fcmTokens[index]);
//     //                 winston.warn(`Invalid FCM token: ${fcmTokens[index]}`);
//     //             } else {
//     //                 winston.error('Error sending notification', { userId, error: res.error.message });
//     //             }
//     //         }
//     //     });

//     //     if (invalidTokens.length > 0) {
//     //         await Fcm.deleteMany({ fcm: { $in: invalidTokens } });
//     //         winston.info(`Removed ${invalidTokens.length} invalid FCM tokens from the database.`);
//     //     }

//     //     return { message: 'Notification sent', success: true, response };
//     // } catch (error) {
//     //     winston.error('Error sending notification', { userId, error: error.message });
//     //     throw error;
//     // }
// };

export { admin };
