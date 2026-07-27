import express, { Response } from 'express';
import { admin, db } from '../lib/firebase-admin.js';
import { authenticate, verifyAppCheck, inviteLimiter, AuthenticatedRequest } from '../lib/middleware.js';
import { reportSchema } from '../lib/schemas.js';
import { ValidationError, sendErrorResponse } from '../lib/errors.js';

const router = express.Router();

/**
 * Handle User Reports
 * Submits a report to Firestore and optionally alerts via Discord Webhook
 */
router.post('/report', authenticate, inviteLimiter, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const validation = reportSchema.safeParse(req.body);
        if (!validation.success) {
            throw new ValidationError('Invalid input');
        }

        const {
            messageId,
            groupId,
            reporterNickname,
            reportedUserId,
            reportedUserNickname,
            messageText,
            reason
        } = validation.data;
        
        const uid = req.user!.uid;

        // 1. Save report to Firestore
        const reportData = {
            messageId,
            groupId: groupId || 'Unknown',
            reporterId: uid,
            reporterNickname: reporterNickname || 'Unknown',
            reportedUserId,
            reportedUserNickname: reportedUserNickname || 'Unknown',
            messageText: messageText || '',
            reason,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'pending'
        };
        
        await db.collection('reports').add(reportData);

        // 2. Send Discord Webhook Notification if URL is configured
        const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
        if (discordWebhookUrl) {
            const discordPayload = {
                content: `🚨 **New Report Submitted!** 🚨`,
                embeds: [{
                    title: "Message Report Details",
                    color: 0xff0000, // Red
                    fields: [
                        { name: "Reason", value: reason, inline: true },
                        { name: "Status", value: "Pending", inline: true },
                        { name: "Reported User", value: `${reportedUserNickname || 'Unknown'} (${reportedUserId})`, inline: false },
                        { name: "Reporter", value: `${reporterNickname || 'Unknown'} (${uid})`, inline: false },
                        { name: "Group ID", value: groupId || "Unknown", inline: false },
                        { name: "Message ID", value: messageId, inline: false },
                        { name: "Message Content", value: messageText ? `\`\`\`${messageText.substring(0, 1000)}\`\`\`` : "*No text/Image only*", inline: false }
                    ],
                    timestamp: new Date().toISOString()
                }]
            };

            try {
                await fetch(discordWebhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(discordPayload)
                });
            } catch (webhookError: unknown) {
                const error = webhookError as Error;
                console.error("Failed to send Discord webhook:", error.message);
                // We don't fail the request if webhook fails, report is already saved
            }
        }

        res.status(200).json({ message: 'Report submitted successfully' });
    } catch (error) {
        console.error('Error submitting report:', error);
        sendErrorResponse(res, error, 'Internal Server Error');
    }
});

export default router;
