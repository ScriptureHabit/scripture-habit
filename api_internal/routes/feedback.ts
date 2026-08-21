import express, { Response } from 'express';
import { admin, db } from '../lib/firebase-admin.js';
import { authenticate, verifyAppCheck, inviteLimiter, AuthenticatedRequest } from '../lib/middleware.js';
import { feedbackSchema } from '../lib/schemas.js';
import { ValidationError, sendErrorResponse } from '../lib/errors.js';

const router = express.Router();

/**
 * Handle User Feedback (Ideas, Bugs, Cheers)
 * Submits feedback to Firestore and optionally alerts via Discord Webhook
 */
router.post('/feedback', authenticate, inviteLimiter, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const validation = feedbackSchema.safeParse(req.body);
        if (!validation.success) {
            throw new ValidationError('Invalid feedback input');
        }

        const { category, message, userNickname, userEmail } = validation.data;
        const uid = req.user!.uid;
        const email = userEmail || req.user!.email || null;

        // 1. Save feedback to Firestore
        const feedbackData = {
            userId: uid,
            userNickname: userNickname || 'Anonymous',
            userEmail: email,
            category,
            message,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'unread'
        };

        await db.collection('feedbacks').add(feedbackData);

        // 2. Optional: Send Discord Webhook Notification if URL is configured
        const discordWebhookUrl = process.env.DISCORD_FEEDBACK_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
        if (discordWebhookUrl) {
            const categoryLabels: Record<string, string> = {
                idea: '💡 Idea / Feature Request',
                bug: '🐛 Bug Report',
                cheer: '💖 Encouragement / Feedback'
            };

            const discordPayload = {
                content: `📬 **New Feedback Received!** (${categoryLabels[category] || category})`,
                embeds: [{
                    title: `Feedback: ${categoryLabels[category] || category}`,
                    color: category === 'bug' ? 0xe53e3e : category === 'idea' ? 0x3182ce : 0x38a169,
                    fields: [
                        { name: "From", value: `${userNickname || 'Anonymous'} (${email || 'No email'})`, inline: true },
                        { name: "User ID", value: uid, inline: true },
                        { name: "Category", value: category, inline: true },
                        { name: "Message", value: message ? `\`\`\`${message.substring(0, 1500)}\`\`\`` : "*(empty)*", inline: false }
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
                console.error("Failed to send feedback Discord webhook:", error.message);
            }
        }

        res.status(200).json({ success: true, message: 'Feedback submitted successfully' });
    } catch (error) {
        console.error('Error submitting feedback:', error);
        sendErrorResponse(res, error, 'Internal Server Error');
    }
});

export default router;
