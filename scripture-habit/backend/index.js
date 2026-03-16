const express = require('express');
const path = require('path');
const { z } = require('zod');
const admin = require('firebase-admin');
const cors = require('cors');
const axios = require('axios'); // Add axios
const cheerio = require('cheerio');
const crypto = require('crypto');

// Load .env from project root (one level up from backend/ directory)
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("WARNING: GEMINI_API_KEY is not set in environment variables.");
} else {
  console.log(`GEMINI_API_KEY loaded: ${apiKey.substring(0, 4)}...`);
}

const app = express();

app.use(cors());
app.use(express.json());

// Initialize Firebase Admin SDK
// Try to get credentials from environment variables first (Vercel)
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require('./serviceAccountKey.json'); // Fallback for local dev

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const messaging = admin.messaging(); // Initialize messaging

async function getUserFcmTokens(uid) {
  const tokens = [];
  const userDoc = await db.collection('users').doc(uid).get();
  if (userDoc.exists && userDoc.data().fcmTokens) {
    tokens.push(...userDoc.data().fcmTokens);
  }
  const privateDoc = await db.collection('users').doc(uid).collection('private').doc('tokens').get();
  if (privateDoc.exists && privateDoc.data().fcmTokens) {
    tokens.push(...privateDoc.data().fcmTokens);
  }
  return [...new Set(tokens)];
}

/**
 * Sends a push notification to multiple FCM tokens
 */
async function sendPushNotification(tokens, payload) {
  if (!tokens || tokens.length === 0) return;

  // Clean up duplicate tokens
  const uniqueTokens = [...new Set(tokens)];

  const message = {
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data || {},
    tokens: uniqueTokens,
  };

  try {
    const response = await messaging.sendEachForMulticast(message);
    console.log(`Successfully sent ${response.successCount} messages; ${response.failureCount} messages failed.`);

    // Optional: Handle invalid tokens by removing them from the database
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(uniqueTokens[idx]);
        }
      });
      // You could implement logic here to remove these tokens from user docs
    }
    return response;
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}

/**
 * Utility to notify all members of a group except the sender
 */
async function notifyGroupMembers(groupId, senderUid, payload, memberIdsOverride = null) {
  try {
    let membersToNotify;

    if (memberIdsOverride) {
      membersToNotify = memberIdsOverride.filter(uid => uid !== senderUid);
    } else {
      const groupDoc = await db.collection('groups').doc(groupId).get();
      if (!groupDoc.exists) return;

      const groupData = groupDoc.data();
      const members = groupData.members || [];
      membersToNotify = members.filter(uid => uid !== senderUid);
    }

    const tokens = [];
    for (const memberUid of membersToNotify) {
      const memberTokens = await getUserFcmTokens(memberUid);
      if (memberTokens.length > 0) {
        tokens.push(...memberTokens);
      }
    }

    if (tokens.length > 0) {
      await sendPushNotification(tokens, payload);
    }
  } catch (error) {
    console.error('Error in notifyGroupMembers:', error);
  }
}


const supportedLanguages = ['en', 'ja', 'es', 'pt', 'zh', 'zho', 'vi', 'th', 'ko', 'tl', 'sw'];

const postNoteSchema = z.object({
  chapter: z.string().min(1).max(500),
  scripture: z.string().min(1).max(100),
  title: z.string().max(200).optional().nullable(),
  speaker: z.string().max(100).optional().nullable(),
  comment: z.string().max(10000),
  shareOption: z.enum(['all', 'current', 'specific', 'none']),
  selectedShareGroups: z.array(z.string()).optional().nullable(),
  isGroupContext: z.boolean().optional().nullable(),
  currentGroupId: z.string().optional().nullable(),
  language: z.enum(supportedLanguages).optional().nullable()
});

const sendCheerSchema = z.object({
  targetUid: z.string().min(1),
  groupId: z.string().min(1),
  senderNickname: z.string().min(1),
  language: z.enum(supportedLanguages).optional()
});

const CHEER_NOTIFICATION_TEMPLATES = {
  en: [
    "{nickname} is waiting for your post! ✨",
    "{nickname} is looking forward to your study note! 📖",
    "Let's aim for 100% unity! {nickname} sent you an energy boost! 💪"
  ],
  ja: [
    "{nickname}さんがあなたの投稿を楽しみに待っています！✨",
    "{nickname}さんがあなたの学習ノートを心待ちにしています！📖",
    "全員投稿まであと少し！{nickname}さんからエールが届きました！💪"
  ],
  es: [
    "¡{nickname} está esperando tu nota! ✨",
    "¡{nickname} espera con ansias tu nota de estudio! 📖",
    "¡Busquemos el 100% de unidad! ¡{nickname} te envió un impulso de energía! 💪"
  ],
  pt: [
    "{nickname} está esperando sua postagem! ✨",
    "{nickname} está ansioso pela sua nota de estudo! 📖",
    "Vamos buscar 100% de união! {nickname} te enviou um impulso de energia! 💪"
  ],
  zh: [
    "{nickname} 正在等待您的發文！✨",
    "{nickname} 期待著您的學習筆記！📖",
    "目標 100% 合一！{nickname} 給您送來了力量！💪"
  ],
  zho: [
    "{nickname} 正在等待您的發文！✨",
    "{nickname} 期待著您的學習筆記！📖",
    "目標 100% 合一！{nickname} 給您送來了力量！💪"
  ],
  vi: [
    "{nickname} đang chờ bài đăng của bạn! ✨",
    "{nickname} đang mong chờ ghi chú học tập của bạn! 📖",
    "Hãy cùng hướng tới sự đoàn kết 100%! {nickname} đã gửi cho bạn thêm năng lượng! 💪"
  ],
  th: [
    "{nickname} กำลังรอโพสต์ของคุณอยู่! ✨",
    "{nickname} กำลังตั้งตารอบันทึกการศึกษาของคุณ! 📖",
    "มาตั้งเป้าความเป็นน้ำหนึ่งใจเดียวกัน 100% กันเถอะ! {nickname} ส่งพลังให้คุณ! 💪"
  ],
  ko: [
    "{nickname}님이 당신의 게시물을 기다리고 있습니다! ✨",
    "{nickname}님이 당신의 학습 노트를 고대하고 있습니다! 📖",
    "100% 일치를 목표로 합시다! {nickname}님이 응원을 보냈습니다! 💪"
  ],
  tl: [
    "Naghihintay si {nickname} para sa iyong post! ✨",
    "Inaasahan ni {nickname} ang iyong study note! 📖",
    "Layunin natin ang 100% unity! Nagpadala si {nickname} ng energy boost sa iyo! 💪"
  ],
  sw: [
    "{nickname} anasubiri chapisho lako! ✨",
    "{nickname} anatarajia dokezo lako la funzo! 📖",
    "Tulenge umoja wa 100%! {nickname} amekutumia nguvu! 💪"
  ]
};

const STREAK_ANNOUNCEMENT_TEMPLATES = {
  en: "🎉🎉🎉 **{nickname} reached a {streak} day streak!!** 🎉🎉🎉\n\n**Let us edify one another in the group and share joy together!**",
  ja: "🎉🎉🎉 **{nickname}さんが{streak}日連続達成しました！！** 🎉🎉🎉\n\n**グループ内で互いに教え合い、喜びを分かち合いましょう！**",
  es: "🎉🎉🎉 **¡{nickname} alcanzó una racha de {streak} días!** 🎉🎉🎉\n\n**¡Edifiquémonos unos a otros en el grupo y compartamos la alegría juntos!**",
  pt: "🎉🎉🎉 **{nickname} atingiu uma sequência de {streak} dias!!** 🎉🎉🎉\n\n**Vamos edificar uns aos outros no grupo e compartilhar alegria juntos!**",
  zh: "🎉🎉🎉 **{nickname} 已連讀 {streak} 天！！** 🎉🎉🎉\n\n**讓我們在群組中互相啟發，共同分享喜悦！**",
  zho: "🎉🎉🎉 **{nickname} 已連讀 {streak} 天！！** 🎉🎉🎉\n\n**讓我們在群組中互相啟發，共同分享喜悦！**",
  vi: "🎉🎉🎉 **{nickname} đã đạt chuỗi {streak} ngày!!** 🎉🎉🎉\n\n**Hãy cùng nhau học hỏi trong nhóm và chia sẻ niềm vui nhé!**",
  th: "🎉🎉🎉 **{nickname} บรรลุสถิติต่อเนื่อง {streak} วัน!!** 🎉🎉🎉\n\n**ขอให้เราจรรโลงใจซึ่งกันและกันในกลุ่มและแบ่งปันความสุขด้วยกัน!**",
  ko: "🎉🎉🎉 **{nickname}님이 {streak}일 연속 달성했습니다！！** 🎉🎉🎉\n\n**그룹 내에서 서로를 고취하며 기쁨을 함께 나눕시다！**",
  tl: "🎉🎉🎉 **Naabot ni {nickname} ang {streak} na araw na streak!!** 🎉🎉🎉\n\n**Magtulungan tayo sa pag-aaral sa grupo at magbahagi ng kagalakan!**",
  sw: "🎉🎉🎉 **{nickname} amefikisha mfululizo wa siku {streak}!!** 🎉🎉🎉\n\n**Na tujengane mmoja kwa mwingine katika kikundi na tushiriki furaha pamoja!**"
};

// API Model Configuration - Using exact name from your screenshot
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const languageNames = {
  'ja': 'Japanese',
  'en': 'English',
  'es': 'Spanish',
  'pt': 'Portuguese',
  'ko': 'Korean',
  'zho': 'Chinese (Traditional)',
  'vi': 'Vietnamese',
  'th': 'Thai',
  'tl': 'Tagalog',
  'sw': 'Swahili'
};

// Handle User Reports and send to Discord Webhook
app.post('/report', async (req, res) => {
  const authHeader = req.headers.authorization;
  let idToken;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    idToken = authHeader.split('Bearer ')[1];
  } else if (req.body.token) {
    idToken = req.body.token;
  } else {
    return res.status(401).json({ error: 'Unauthorized: No token provided.' });
  }

  const {
    messageId,
    groupId,
    reporterNickname,
    reportedUserId,
    reportedUserNickname,
    messageText,
    reason
  } = req.body;

  if (!messageId || !reportedUserId || !reason) {
    return res.status(400).json({ error: 'Missing required report fields.' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const db = admin.firestore();

    // 1. Save report to Firestore
    const reportData = {
      messageId,
      groupId,
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
            { name: "Reported User", value: `${reportedUserNickname} (${reportedUserId})`, inline: false },
            { name: "Reporter", value: `${reportData.reporterNickname} (${uid})`, inline: false },
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
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(discordPayload)
        });
      } catch (webhookError) {
        console.error("Failed to send Discord webhook:", webhookError.message);
        // We don't fail the request if webhook fails, report is already saved
      }
    }

    res.status(200).json({ message: 'Report submitted successfully' });
  } catch (error) {
    console.error('Error submitting report:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/translate', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided.' });
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    await admin.auth().verifyIdToken(idToken);
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token.' });
  }

  const { text, targetLanguage } = req.body;

  if (!text || !targetLanguage) {
    return res.status(400).json({ error: 'Text and targetLanguage are required.' });
  }

  if (!supportedLanguages.includes(targetLanguage)) {
    return res.status(400).json({ error: 'Unsupported language.' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Gemini API Key is not configured.' });
  }

  try {
    // Generate a cache key
    const cacheKey = crypto.createHash('md5').update(`${text}_${targetLanguage}`).digest('hex');
    const cacheRef = db.collection('translation_cache').doc(cacheKey);

    // 1. Check Cache
    const cacheDoc = await cacheRef.get();
    if (cacheDoc.exists) {
      const cachedData = cacheDoc.data();
      console.log('Serving translation from cache');
      return res.json({ translatedText: cachedData.translatedText });
    }

    console.log(`Translating (Fresh): "${text.substring(0, 20)}..." to ${targetLanguage}`);

    const targetLangName = languageNames[targetLanguage] || targetLanguage;
    const prompt = `Task: Translate the following text into ${targetLangName}. 
Output only the translated text. No explanations.

Text:
${text}`;

    const apiUrl = `${GEMINI_API_URL}?key=${process.env.GEMINI_API_KEY}`;

    const response = await axios.post(apiUrl, {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
      ]
    });

    const candidate = response.data?.candidates?.[0];
    const rawText = candidate?.content?.parts?.[0]?.text || '';

    // Powerful Cleanup: Remove common AI preambles, notes, and quotes
    let resultText = rawText
      .replace(/<translation>|<\/translation>/gi, '') // Remove tags if present
      .replace(/^.*?translation.*?:/i, '')           // Remove "Here is the translation:"
      .replace(/^.*?translated text.*?:/i, '')       // Remove "The translated text is:"
      .replace(/---[\s\S]*$/g, '')                   // Remove everything after horizontal rule
      .replace(/\*\*Notes:[\s\S]*$/gi, '')            // Remove "Notes:" section
      .replace(/\*\*Notes on[\s\S]*$/gi, '')          // Remove "Notes on translation"
      .replace(/^["'「](.*)["'」]$/g, '$1')           // Remove surrounding quotes
      .trim();

    // Fallback: If cleanup returns empty, take the first non-empty line
    if (!resultText && rawText) {
      resultText = rawText.split('\n').find(line => line.trim().length > 0) || rawText;
    }

    if (!resultText) {
      console.error('Gemini Safety/Error or Empty:', JSON.stringify(response.data, null, 2));
      throw new Error(`AI blocked the response or failed to format. Reason: ${candidate?.finishReason || 'Unknown'}`);
    }


    // 2. Save to Cache (asynchronously)
    cacheRef.set({
      originalText: text,
      translatedText: resultText,
      targetLanguage: targetLanguage,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }).catch(err => console.error('Error saving to translation cache:', err));

    res.json({ translatedText: resultText });
  } catch (error) {
    console.error('CRITICAL Error in AI translation:', error.message);
    if (error.response) console.error('Error Details:', JSON.stringify(error.response.data, null, 2));
    res.status(500).json({ error: 'Failed to translate', details: error.message });
  }
});

app.post('/verify-login', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).send('ID token is required.');
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Enforce Email Verification for password provider
    if (decodedToken.firebase && decodedToken.firebase.sign_in_provider === 'password' && !decodedToken.email_verified) {
      return res.status(403).send('Email not verified. Please check your email inbox.');
    }

    const uid = decodedToken.uid;
    const email = decodedToken.email;

    console.log('Verified user:', { uid, email });




    res.status(200).send({ message: 'Login verified successfully.', user: { uid, email } });
  } catch (error) {
    console.error('Error verifying ID token:', error);
    res.status(401).send('Unauthorized: Invalid ID token.');
  }
});


app.post('/join-group', async (req, res) => {
  const authHeader = req.headers.authorization;
  let idToken;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    idToken = authHeader.split('Bearer ')[1];
  } else if (req.body.token) {
    idToken = req.body.token;
  } else {
    return res.status(401).send('Unauthorized: No token provided.');
  }

  const { groupId, inviteCode } = req.body;
  if (!groupId && !inviteCode) return res.status(400).send('Group ID or invite code is required.');

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Enforce Email Verification for password provider
    if (decodedToken.firebase && decodedToken.firebase.sign_in_provider === 'password' && !decodedToken.email_verified) {
      return res.status(403).send('Email not verified. Please verify your email before joining a group.');
    }

    const uid = decodedToken.uid;
    const db = admin.firestore();

    await db.runTransaction(async (t) => {
      const userRef = db.collection('users').doc(uid);
      let groupRef;
      let targetGroupId = groupId;
      let groupDoc;

      if (inviteCode) {
        const snapshot = await t.get(db.collection('groups').where('inviteCode', '==', inviteCode).limit(1));
        if (snapshot.empty) throw new Error('Invalid invite code.');
        groupDoc = snapshot.docs[0];
        groupRef = groupDoc.ref;
        targetGroupId = groupDoc.id;
      } else {
        groupRef = db.collection('groups').doc(targetGroupId);
        groupDoc = await t.get(groupRef);
        if (!groupDoc.exists) throw new Error('Group not found.');
      }

      const userDoc = await t.get(userRef);
      const userData = userDoc.data() || {};
      const groupIds = userData.groupIds || (userData.groupId ? [userData.groupId] : []);

      if (groupIds.includes(targetGroupId)) throw new Error('User already in this group.');
      if (groupIds.length >= 12) throw new Error('You can only join up to 12 groups.');

      const groupData = groupDoc.data();

      // Check if user is already a member of the group
      if (groupData.members && groupData.members.includes(uid)) {
        if (!groupIds.includes(targetGroupId)) {
          // Inconsistency detected: User is in group members but group is not in user's list.
          // Repair: Add to user's list
          t.update(userRef, {
            groupIds: admin.firestore.FieldValue.arrayUnion(targetGroupId)
          });
          return; // Exit transaction successfully, skipping other updates
        } else {
          throw new Error('User already in this group.');
        }
      }

      if (groupData.membersCount >= groupData.maxMembers) throw new Error('Group is full.');

      t.update(groupRef, {
        members: admin.firestore.FieldValue.arrayUnion(uid),
        membersCount: admin.firestore.FieldValue.increment(1),
        [`memberKickThresholds.${uid}`]: userData.kickThreshold || 3
      });

      // Update user's groupIds and set groupId to the new one (as "active" or "primary")
      if (!userData.groupIds && userData.groupId) {
        // Migration: User has a group but no groupIds array yet.
        // Initialize array with both the old group and the new group.
        const uniqueIds = [...new Set([userData.groupId, targetGroupId])];
        t.update(userRef, {
          groupIds: uniqueIds,
          groupId: targetGroupId
        });
      } else {
        t.update(userRef, {
          groupIds: admin.firestore.FieldValue.arrayUnion(targetGroupId),
          groupId: targetGroupId
        });
      }

      // Add system message
      const messagesRef = groupRef.collection('messages').doc();
      t.set(messagesRef, {
        text: `👋 **${userData.nickname || 'A user'}** joined the group!`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        senderId: 'system',
        isSystemMessage: true,
        type: 'join'
      });
    });

    res.status(200).send({ message: 'Successfully joined group.', groupId: targetGroupId });
  } catch (error) {
    console.error('Error joining group:', error);
    res.status(500).send(error.message || 'Internal Server Error');
  }
});


app.post('/leave-group', async (req, res) => {
  const authHeader = req.headers.authorization;
  let idToken;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    idToken = authHeader.split('Bearer ')[1];
  } else if (req.body.token) {
    idToken = req.body.token;
  } else {
    return res.status(401).send('Unauthorized: No token provided.');
  }

  const { groupId } = req.body;

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const db = admin.firestore();

    await db.runTransaction(async (t) => {
      const userRef = db.collection('users').doc(uid);
      const userDoc = await t.get(userRef);

      if (!userDoc.exists) throw new Error('User not found.');
      const userData = userDoc.data();

      // Determine which group to leave
      const targetGroupId = groupId || userData.groupId;
      if (!targetGroupId) throw new Error('No group specified to leave.');

      const groupRef = db.collection('groups').doc(targetGroupId);
      const groupDoc = await t.get(groupRef);

      if (groupDoc.exists) {
        t.update(groupRef, {
          members: admin.firestore.FieldValue.arrayRemove(uid),
          membersCount: admin.firestore.FieldValue.increment(-1)
        });
      }

      // Update user data
      const currentGroupIds = userData.groupIds || (userData.groupId ? [userData.groupId] : []);
      const newGroupIds = currentGroupIds.filter(id => id !== targetGroupId);

      let newPrimaryGroupId = userData.groupId;
      if (userData.groupId === targetGroupId) {
        newPrimaryGroupId = newGroupIds.length > 0 ? newGroupIds[0] : null;
      }

      t.update(userRef, {
        groupIds: admin.firestore.FieldValue.arrayRemove(targetGroupId),
        groupId: newPrimaryGroupId
      });

      // Add system message
      if (groupDoc.exists) {
        const messagesRef = groupRef.collection('messages').doc();
        t.set(messagesRef, {
          text: `🚪 **${userData.nickname || 'A user'}** left the group.`,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          senderId: 'system',
          isSystemMessage: true,
          type: 'leave'
        });
      }
    });

    res.status(200).send({ message: 'Successfully left group.' });
  } catch (error) {
    console.error('Error leaving group:', error);
    res.status(500).send(error.message || 'Internal Server Error');
  }
});


app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

app.post('/update-kick-threshold', async (req, res) => {
  const authHeader = req.headers.authorization;
  let idToken;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    idToken = authHeader.split('Bearer ')[1];
  } else {
    console.error('No Bearer token found in authorization header');
    return res.status(401).send('Unauthorized');
  }

  const { threshold } = req.body;
  if (threshold === undefined) {
    console.error('Threshold is missing in request body');
    return res.status(400).send('Missing threshold');
  }

  console.log(`Updating kick threshold to ${threshold} for user...`);

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    console.log(`Verified UID: ${uid}`);
    
    const db = admin.firestore();
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    
    if (!userSnap.exists) {
      console.error(`User document not found for UID: ${uid}`);
      return res.status(404).send('User not found');
    }
    
    const userData = userSnap.data();
    const groupIds = userData.groupIds || (userData.groupId ? [userData.groupId] : []);
    const thresholdNum = parseInt(threshold, 10);

    console.log(`User is in ${groupIds.length} groups. Proceeding with batch update.`);

    // Batch update
    const batch = db.batch();
    
    // 1. Update User Doc
    batch.update(userRef, { 
      kickThreshold: thresholdNum,
      hasSetKickThreshold: true 
    });

    // 2. Update all Groups
    groupIds.forEach(gid => {
      if (gid) {
        const groupRef = db.collection('groups').doc(gid);
        batch.update(groupRef, {
          [`memberKickThresholds.${uid}`]: thresholdNum
        });
      }
    });

    await batch.commit();
    console.log('Batch update successfully committed.');

    res.status(200).json({ message: 'Threshold updated successfully across all groups' });
  } catch (error) {
    console.error('CRITICAL ERROR in /update-kick-threshold:', error);
    res.status(500).send(`Server Error: ${error.message}`);
  }
});


app.get('/groups', async (req, res) => {
  try {
    const db = admin.firestore();
    const groupsRef = db.collection('groups');

    const snapshot = await groupsRef
      .where('isPublic', '==', true)
      .get();

    const groups = [];
    snapshot.forEach(doc => {
      groups.push({ id: doc.id, ...doc.data() });
    });

    // Sort by membersCount ascending (handle missing count as 0)
    groups.sort((a, b) => (a.membersCount || 0) - (b.membersCount || 0));

    // Return top 20
    res.status(200).json(groups.slice(0, 20));
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).send('Error fetching groups.');
  }
});


// Delete group - removes group from all members and cleans up data
app.post('/delete-group', async (req, res) => {
  const authHeader = req.headers.authorization;
  let idToken;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    idToken = authHeader.split('Bearer ')[1];
  } else if (req.body.token) {
    idToken = req.body.token;
  } else {
    return res.status(401).send('Unauthorized: No token provided.');
  }

  const { groupId } = req.body;
  if (!groupId) return res.status(400).send('Group ID is required.');

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const db = admin.firestore();

    // First, get the group and verify ownership
    const groupRef = db.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists) {
      return res.status(404).send('Group not found.');
    }

    const groupData = groupDoc.data();

    // Only the owner can delete the group
    if (groupData.ownerUserId !== uid) {
      return res.status(403).send('Only the group owner can delete the group.');
    }

    const members = groupData.members || [];
    console.log(`Deleting group ${groupId} with ${members.length} members`);

    // Step 1: Remove group from all members' groupIds and delete their groupStates
    const batch = db.batch();

    for (const memberId of members) {
      const userRef = db.collection('users').doc(memberId);
      const userDoc = await userRef.get();

      if (userDoc.exists) {
        const userData = userDoc.data();
        const currentGroupIds = userData.groupIds || [];
        const newGroupIds = currentGroupIds.filter(id => id !== groupId);

        // Determine new primary groupId
        let newPrimaryGroupId = userData.groupId;
        if (userData.groupId === groupId) {
          newPrimaryGroupId = newGroupIds.length > 0 ? newGroupIds[0] : '';
        }

        batch.update(userRef, {
          groupIds: admin.firestore.FieldValue.arrayRemove(groupId),
          groupId: newPrimaryGroupId
        });

        // Delete user's groupState for this group
        const groupStateRef = db.collection('users').doc(memberId).collection('groupStates').doc(groupId);
        batch.delete(groupStateRef);
      }
    }

    await batch.commit();
    console.log(`Removed group from ${members.length} members`);

    // Step 2: Delete messages subcollection (in batches of 500)
    const messagesRef = groupRef.collection('messages');
    const messagesSnapshot = await messagesRef.get();

    if (!messagesSnapshot.empty) {
      const messageBatches = [];
      let messageBatch = db.batch();
      let count = 0;

      messagesSnapshot.forEach(doc => {
        messageBatch.delete(doc.ref);
        count++;

        if (count >= 500) {
          messageBatches.push(messageBatch);
          messageBatch = db.batch();
          count = 0;
        }
      });

      if (count > 0) {
        messageBatches.push(messageBatch);
      }

      for (const b of messageBatches) {
        await b.commit();
      }
      console.log(`Deleted ${messagesSnapshot.size} messages`);
    }

    // Step 3: Delete the group document
    await groupRef.delete();
    console.log(`Group ${groupId} deleted successfully`);

    res.status(200).send({ message: 'Group deleted successfully.' });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).send(error.message || 'Internal Server Error');
  }
});


app.get('/group-preview/:inviteCode', async (req, res) => {
  const { inviteCode } = req.params;
  if (!inviteCode) return res.status(400).send('Invite code is required');

  try {
    const db = admin.firestore();
    const snapshot = await db.collection('groups').where('inviteCode', '==', inviteCode).limit(1).get();

    if (snapshot.empty) {
      return res.status(404).send('Group not found');
    }

    const groupData = snapshot.docs[0].data();
    
    // Only return safe public info
    res.status(200).json({
      name: groupData.name,
      description: groupData.description,
      isPublic: groupData.isPublic
    });
  } catch (error) {
    console.error('Error fetching group preview:', error);
    res.status(500).send('Error fetching group preview.');
  }
});

app.post('/migrate-data', async (req, res) => {


  console.log('Starting data migration on backend...');
  const db = admin.firestore();

  try {

    const groupsSnapshot = await db.collection('groups').get();
    console.log(`Found ${groupsSnapshot.size} groups.`);
    let messagesMigrated = 0;

    for (const groupDoc of groupsSnapshot.docs) {
      const messagesRef = groupDoc.ref.collection('messages');

      const messagesSnapshot = await messagesRef.where('isEntry', '==', true).get();

      if (messagesSnapshot.empty) continue;

      const batch = db.batch();
      let batchCount = 0;

      messagesSnapshot.forEach(doc => {

        if (doc.data().isNote === undefined) {
          batch.update(doc.ref, { isNote: true });
          batchCount++;
          messagesMigrated++;
        }
      });

      if (batchCount > 0) {
        await batch.commit();
        console.log(`Migrated ${batchCount} messages in group ${groupDoc.id}`);
      }
    }


    const usersSnapshot = await db.collection('users').get();
    console.log(`Found ${usersSnapshot.size} users.`);
    let usersMigrated = 0;

    const userBatch = db.batch();
    let userBatchCount = 0;

    usersSnapshot.forEach(userDoc => {
      const data = userDoc.data();
      if (data.totalEntries !== undefined && data.totalNotes === undefined) {
        userBatch.update(userDoc.ref, { totalNotes: data.totalEntries });
        userBatchCount++;
        usersMigrated++;
      }
    });

    if (userBatchCount > 0) {
      await userBatch.commit();
    }

    console.log('Migration complete.');
    res.status(200).json({
      message: 'Migration complete',
      stats: {
        messagesMigrated,
        usersMigrated
      }
    });

  } catch (error) {
    console.error('Migration failed:', error);
    res.status(500).send('Migration failed: ' + error.message);
  }
});


app.post('/post-message', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send('Unauthorized');
  }

  const idToken = authHeader.split('Bearer ')[1];
  const { groupId, text, replyTo } = req.body;

  if (!groupId || !text) {
    return res.status(400).send('Group ID and text are required.');
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(404).send('User not found');
    const userData = userSnap.data();

    const msgRef = db.collection('groups').doc(groupId).collection('messages').doc();
    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

    await db.runTransaction(async (transaction) => {
      transaction.set(msgRef, {
        text,
        senderId: uid,
        senderNickname: userData.nickname || 'Member',
        senderPhotoURL: userData.photoURL || null,
        createdAt: serverTimestamp,
        replyTo: replyTo || null
      });

      transaction.update(db.collection('groups').doc(groupId), {
        messageCount: admin.firestore.FieldValue.increment(1),
        lastMessageAt: serverTimestamp,
        [`memberLastActive.${uid}`]: serverTimestamp
      });
    });

    // Notify other members
    notifyGroupMembers(groupId, uid, {
      title: userData.nickname || 'Member',
      body: text.substring(0, 100),
      data: { type: 'chat', groupId }
    }).catch(e => console.error('Error sending chat notifications:', e));

    res.status(200).json({ message: 'Message sent successfully.', id: msgRef.id });
  } catch (error) {
    console.error('Error in /post-message:', error);
    res.status(500).send(error.message);
  }
});


app.post('/post-note', async (req, res) => {
  console.log('--- POST NOTE REQUEST ---');
  console.log('Body:', JSON.stringify(req.body, null, 2));

  const validation = postNoteSchema.safeParse(req.body);
  if (!validation.success) {
    console.error('Validation failed:', validation.error.format());
    return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });
  }

  const { chapter, scripture, title, speaker, comment, shareOption, selectedShareGroups, isGroupContext, currentGroupId, language } = validation.data;

  const authHeader = req.headers.authorization;
  let idToken;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    idToken = authHeader.split('Bearer ')[1];
  } else {
    return res.status(401).send('Unauthorized: No token provided.');
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const db = admin.firestore();
    console.log(`User ${uid} authenticated`);

    const sLower = (scripture || "").toLowerCase();
    const isOther = sLower.includes("other") || sLower.includes("その他") || scripture === "";
    const isGC = sLower.includes("general") || sLower.includes("総大会");
    const isBYU = sLower.includes("byu");

    let messageText;
    if (isOther) {
      // chapter holds the raw URL. ALWAYS save it to text body.
      messageText = `📖 **New Study Note**\n\n**Scripture:** ${scripture}\n\n**Url:** ${chapter}\n\n${comment || ''}`;
    } else if (isGC) {
      const talkVal = title || chapter || "";
      const isUrl = chapter && (chapter.toLowerCase().startsWith('http') || /^\d{4}\/\d{2}\/.+/.test(chapter));
      messageText = `📖 **New Study Note**\n\n**Scripture:** ${scripture}\n\n**Talk:** ${talkVal}\n${isUrl ? `**Url:** ${chapter}\n` : ''}\n${comment || ''}`;
    } else if (isBYU) {
      messageText = `📖 **New Study Note**\n\n**Scripture:** ${scripture}\n\n**Speech:** ${title || "Speech"}\n**Url:** ${chapter}\n\n${comment || ''}`;
    } else {
      messageText = `📖 **New Study Note**\n\n**Scripture:** ${scripture}\n\n**Chapter:** ${chapter}\n\n${comment || ''}`;
    }

    let groupsToPostTo = [];
    let userData = {};
    const result = await db.runTransaction(async (transaction) => {
      console.log('Starting transaction...');
      const userRef = db.collection('users').doc(uid);
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) throw new Error('User not found.');
      userData = userDoc.data();

      // 1. Streak and Stats Logic
      let timeZone = 'UTC';
      try {
        if (userData.timeZone) {
          // Verify if timezone is valid
          Intl.DateTimeFormat(undefined, { timeZone: userData.timeZone });
          timeZone = userData.timeZone;
        }
      } catch (tzError) {
        console.warn(`Invalid timezone ${userData.timeZone}, falling back to UTC`);
      }

      const now = new Date();
      const todayStr = now.toLocaleDateString('en-CA', { timeZone });
      let lastPostDate = null;
      if (userData.lastPostDate) {
        lastPostDate = userData.lastPostDate.toDate ? userData.lastPostDate.toDate() : new Date(userData.lastPostDate);
      }

      let newStreak = userData.streakCount || 0;
      let streakUpdated = false;

      if (!lastPostDate) {
        newStreak = 1;
        streakUpdated = true;
      } else {
        const lastPostDateStr = lastPostDate.toLocaleDateString('en-CA', { timeZone });
        if (todayStr !== lastPostDateStr) {
          const todayDate = new Date(todayStr);
          const lastPostDateObj = new Date(lastPostDateStr);
          const diffTime = todayDate - lastPostDateObj;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays === 1) {
            newStreak += 1;
          } else {
            newStreak = 1;
          }
          streakUpdated = true;
        } else if (newStreak === 0) {
          newStreak = 1;
          streakUpdated = true;
        }
      }

      const userUpdate = {
        lastPostDate: admin.firestore.FieldValue.serverTimestamp(),
        totalNotes: admin.firestore.FieldValue.increment(1)
      };
      if (streakUpdated) {
        userUpdate.streakCount = newStreak;
        userUpdate.daysStudiedCount = admin.firestore.FieldValue.increment(1);
      }

      // 2. Determine target groups
      if (shareOption === 'all') {
        groupsToPostTo = userData.groupIds || (userData.groupId ? [userData.groupId] : []);
      } else if (shareOption === 'specific') {
        groupsToPostTo = selectedShareGroups || [];
      } else if (shareOption === 'current') {
        const targetId = currentGroupId || userData.groupId;
        if (targetId) groupsToPostTo = [targetId];
      }

      // Ensure specific group IDs are valid strings and remove duplicates
      groupsToPostTo = [...new Set(groupsToPostTo.filter(gid => typeof gid === 'string' && gid.trim().length > 0))];

      // 3. READ ALL NECESSARY DATA FIRST (Constraint: Reads before Writes)
      console.log(`Fetching ${groupsToPostTo.length} groups before any writes...`);
      const groupRefs = groupsToPostTo.map(gid => db.collection('groups').doc(gid));
      const groupDocs = await Promise.all(groupRefs.map(ref => transaction.get(ref)));

      // 4. NOW START WRITES
      transaction.update(userRef, userUpdate);

      // 3. Create Personal Note
      const personalNoteRef = userRef.collection('notes').doc();
      const noteTimestamp = admin.firestore.Timestamp.now();
      const sharedMessageIds = {};

      // 5. Post to groups and update metadata
      console.log(`Processing ${groupsToPostTo.length} group posts`);

      const userToGroupMap = new Map();

      groupDocs.forEach((groupDoc, idx) => {
        if (!groupDoc.exists) return;
        const gid = groupDoc.id;
        const gData = groupDoc.data();
        
        const members = gData.members || [];
        members.forEach(memberUid => {
          if (memberUid !== uid && !userToGroupMap.has(memberUid)) {
            userToGroupMap.set(memberUid, gid);
          }
        });
        const msgRef = db.collection('groups').doc(gid).collection('messages').doc();
        sharedMessageIds[gid] = msgRef.id;

        transaction.set(msgRef, {
          text: messageText,
          senderId: uid,
          senderNickname: userData.nickname || 'Member',
          createdAt: noteTimestamp,
          isNote: true,
          originalNoteId: personalNoteRef.id,
          scripture: scripture,
          chapter: chapter,
          senderPhotoURL: userData.photoURL || null
        });

        const timeZone = userData.timeZone || 'UTC';
        const todayLabel = new Date().toLocaleDateString('en-CA', { timeZone });
        const updatePayload = {
          messageCount: admin.firestore.FieldValue.increment(1),
          noteCount: admin.firestore.FieldValue.increment(1),
          lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
          lastNoteAt: admin.firestore.FieldValue.serverTimestamp(),
          lastNoteByNickname: userData.nickname || 'Member',
          lastNoteByUid: uid,
          lastMessageByNickname: userData.nickname || 'Member',
          lastMessageByUid: uid,
          [`memberLastActive.${uid}`]: admin.firestore.FieldValue.serverTimestamp(),
          [`memberLastReadAt.${uid}`]: admin.firestore.FieldValue.serverTimestamp()
        };

        if (!gData.dailyActivity || gData.dailyActivity.date !== todayLabel) {
          updatePayload.dailyActivity = { date: todayLabel, activeMembers: [uid] };
        } else {
          updatePayload['dailyActivity.activeMembers'] = admin.firestore.FieldValue.arrayUnion(uid);
        }
        transaction.update(groupRefs[idx], updatePayload);

        const userGroupStateRef = userRef.collection('groupStates').doc(gid);
        transaction.set(userGroupStateRef, {
          readMessageCount: admin.firestore.FieldValue.increment(1),
          lastReadAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      });

      transaction.set(personalNoteRef, {
        text: messageText,
        createdAt: noteTimestamp,
        scripture: scripture,
        chapter: chapter,
        title: title || null,
        speaker: speaker || null,
        comment: comment || '',
        shareOption: shareOption,
        sharedWithGroups: groupsToPostTo,
        sharedMessageIds: sharedMessageIds
      });

      // 5. Streak Announcements
      if (streakUpdated && newStreak > 0) {
        console.log(`Streak updated to ${newStreak}, announcing...`);
        const announceMsg = (STREAK_ANNOUNCEMENT_TEMPLATES[language] || STREAK_ANNOUNCEMENT_TEMPLATES.en)
          .replace('{nickname}', userData.nickname || 'Member')
          .replace('{streak}', newStreak);
        const announceTime = admin.firestore.Timestamp.fromMillis(noteTimestamp.toMillis() + 2000);

        const distinctGroupIds = userData.groupIds || (userData.groupId ? [userData.groupId] : []);
        distinctGroupIds.forEach(gid => {
          const announceRef = db.collection('groups').doc(gid).collection('messages').doc();
          transaction.set(announceRef, {
            text: announceMsg,
            senderId: 'system',
            senderNickname: 'Scripture Habit Bot',
            createdAt: announceTime,
            isSystemMessage: true,
            messageType: 'streakAnnouncement',
            messageData: { nickname: userData.nickname || 'Member', userId: uid, streak: newStreak }
          });
        });
      }

      return { personalNoteId: personalNoteRef.id, newStreak, streakUpdated, userToGroupMapEntries: Array.from(userToGroupMap.entries()) };
    });

    console.log('Post note successful');

    // Send push notifications after successful transaction
    // This is done asynchronously so we don't delay the response to the user
    (async () => {
      try {
        const lang = language || 'ja';
        const titleMap = {
          'ja': '📖 聖典学習',
          'en': '📖 Scripture Study',
          'es': '📖 Estudio de las escrituras',
          'pt': '📖 Estudo das escrituras',
          'ko': '📖 성경 공부',
          'zho': '📖 聖經學習',
          'vi': '📖 Học thánh thư',
          'th': '📖 การศึกษาพระคัมภีร์',
          'tl': '📖 Pag-aaral ng Banal na Kasulatan',
          'sw': '📖 Funzo la Maandiko'
        };
        const bodyTemplateMap = {
          'ja': '{nickname}さんがノートを投稿しました！✨',
          'en': '{nickname} posted a note! ✨',
          'es': '¡{nickname} publicó una nota! ✨',
          'pt': '{nickname} postou uma nota! ✨',
          'ko': '{nickname}님이 노트를 게시했습니다! ✨',
          'zho': '{nickname} 發布了筆記！✨',
          'vi': '{nickname} đã đăng một ghi chú! ✨',
          'th': '{nickname} โพสต์บันทึกแล้ว! ✨',
          'tl': '{nickname} ay nag-post ng note! ✨',
          'sw': '{nickname} ameweka kumbukumbu! ✨'
        };

        const title = titleMap[lang] || titleMap['en'];
        const bodyTemplate = bodyTemplateMap[lang] || bodyTemplateMap['en'];
        const nickname = userData.nickname || (lang === 'ja' ? 'メンバー' : 'Member');
        const body = bodyTemplate.replace('{nickname}', nickname);

        // Group the unique users by the group ID we assigned them
        const groupsToNotifyMap = new Map();
        for (const [memberUid, gid] of result.userToGroupMapEntries) {
          if (!groupsToNotifyMap.has(gid)) {
            groupsToNotifyMap.set(gid, []);
          }
          groupsToNotifyMap.get(gid).push(memberUid);
        }

        // Send notifications per group
        for (const [gid, membersList] of groupsToNotifyMap.entries()) {
          await notifyGroupMembers(gid, uid, {
            title,
            body,
            data: {
              type: 'note',
              groupId: gid
            }
          }, membersList);
        }
      } catch (e) {
        console.error('Error sending push notifications for note:', e);
      }
    })();

    res.status(200).json({ message: 'Note posted successfully.', ...result });
  } catch (error) {
    console.error('CRITICAL ERROR in /post-note:', error);
    if (error.code) console.error('Error Code:', error.code);
    if (error.details) console.error('Error Details:', error.details);

    res.status(500).json({
      error: error.message || 'Error saving note.',
      stack: error.stack,
      details: error
    });
  }
});





// AI Ponder Questions Endpoint
app.post('/generate-ponder-questions', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided.' });
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    await admin.auth().verifyIdToken(idToken);
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token.' });
  }

  const { scripture, chapter, language } = req.body;

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Gemini API Key is not configured.' });
  }

  if (!scripture || !chapter) {
    return res.status(400).json({ error: 'Scripture and chapter are required.' });
  }

  try {
    const langCode = language || 'en';
    let prompt = '';

    if (langCode === 'ja') {
      prompt = `あなたは末日聖徒イエス・キリスト教会の「わたしに従ってきなさい」の学習ガイドです。
ユーザーが「${scripture}」のカテゴリーにある「${chapter}」を読んでいます。
章番号（20など）だけに惑わされず、必ず「書名（創世記、出エジプト記、アルマ書など）」を厳密に確認し、その箇所の内容と文脈に完全に一致した、深く考えるための質問（Ponder Question）を1つだけ提案してください。
箇条書きの記号（*や-など）は使わず、質問文のみをプレーンテキストで出力してください。
霊的な洞察を促す、心に響く質問にしてください。`;
    } else {
      prompt = `You are a "Come, Follow Me" study guide for The Church of Jesus Christ of Latter-day Saints.
The user is reading "${chapter}" from the category "${scripture}".
Strictly verify the specific "Book name" (e.g., Genesis, Exodus, Alma) and do not be confused by just the chapter number. 
Suggest 1 Ponder Question that is perfectly aligned with the content and context of this specific passage.
Do NOT use bullet points or markdown (*, -). Output only the question text.
Make it spiritually thought-provoking.`;
    }

    const apiUrl = `${GEMINI_API_URL}?key=${process.env.GEMINI_API_KEY}`;

    const response = await axios.post(apiUrl, {
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    });

    const generatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error('No content generated from Gemini.');
    }

    res.json({ questions: generatedText });

  } catch (error) {
    console.error('Error generating AI questions:', error.message);
    if (error.response) {
      console.error('Gemini API Error Response:', JSON.stringify(error.response.data, null, 2));
    }
    res.status(500).json({ error: 'Failed to generate questions.', details: error.message });
  }
});

// AI Discussion Starter Endpoint
app.post('/generate-discussion-topic', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided.' });
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    await admin.auth().verifyIdToken(idToken);
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token.' });
  }

  const { language } = req.body;

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Gemini API Key is not configured.' });
  }

  try {
    const langCode = language || 'en';
    let prompt = '';

    if (langCode === 'ja') {
      prompt = `あなたは末日聖徒イエス・キリスト教会の聖典学習グループのファシリテーターです。
グループのメンバーが互いの経験や証を分かち合いたくなるような、話し合いのきっかけとなる質問を1つだけ提案してください。
特定の聖句に限定せず、「今週の学習で」「最近の生活で」といった幅広い文脈で、しかし霊的な深まりをもたらす質問にしてください。
例：「今週、主の助けを感じた瞬間はありましたか？」など。
箇条書きの記号（*や-など）は使わず、質問文のみをプレーンテキストで出力してください。`;
    } else {
      prompt = `You are a facilitator for a scripture study group of The Church of Jesus Christ of Latter-day Saints.
Please suggest 1 discussion starter question that encourages members to share their experiences and testimonies.
Make the question broad enough (e.g., "In your study this week...", "In your life recently...") but spiritually meaningful.
Do NOT use bullet points or markdown (*, -). Output only the question text.`;
    }

    const apiUrl = `${GEMINI_API_URL}?key=${process.env.GEMINI_API_KEY}`;

    const response = await axios.post(apiUrl, {
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    });

    const generatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error('No content generated from Gemini.');
    }

    res.json({ topic: generatedText.trim() });

  } catch (error) {
    console.error('Error generating discussion topic:', error.message);
    res.status(500).json({ error: 'Failed to generate topic.', details: error.message });
  }
});

// AI Weekly Recap Endpoint
app.post('/generate-weekly-recap', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided.' });
  }
  const idToken = authHeader.split('Bearer ')[1];
  let uid;
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    uid = decodedToken.uid;
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token.' });
  }

  const { groupId, language } = req.body;

  if (!groupId) {
    return res.status(400).json({ error: 'Group ID is required.' });
  }
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Gemini API Key is not configured.' });
  }

  try {
    const db = admin.firestore();
    const messagesRef = db.collection('groups').doc(groupId).collection('messages');

    // Calculate date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const timestamp7DaysAgo = admin.firestore.Timestamp.fromDate(sevenDaysAgo);

    // Query notes from last 7 days - Limit to 60 to stay under Gemma's 15K TPM limit
    const snapshot = await messagesRef
      .where('createdAt', '>=', timestamp7DaysAgo)
      .limit(60)
      .get();

    const notes = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // Collect both 'isNote' (legacy) and 'isEntry' (new)
      if (data.isNote || data.isEntry) {
        // Anonymize: only take text/content
        if (data.text) {
          notes.push(data.text);
        }
      }
    });

    if (notes.length === 0) {
      return res.json({ message: 'No notes found for this week, skipping recap.' });
    }

    // Check frequency limit (once per week)
    const groupRef = db.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();
    
    if (!groupDoc.exists) {
      return res.status(404).json({ error: 'Group not found.' });
    }

    const groupData = groupDoc.data();
    
    // Authorization Check: Must be a member of the group
    const members = groupData.members || [];
    if (!members.includes(uid) && groupData.ownerUserId !== uid) {
      return res.status(403).json({ error: 'Forbidden: You are not a member of this group.' });
    }

    if (groupData.lastRecapGeneratedAt) {
      const lastGenerated = groupData.lastRecapGeneratedAt.toDate();
      const now = new Date();
      const diffTime = Math.abs(now - lastGenerated);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 7) {
        return res.status(429).json({
          error: 'Weekly recap can only be generated once a week.',
          nextAvailable: new Date(lastGenerated.getTime() + 7 * 24 * 60 * 60 * 1000)
        });
      }
    }

    const langCode = language || 'en';
    let prompt = '';
    const notesText = notes.join("\n\n---\n\n");

    if (langCode === 'ja') {
      prompt = `あなたは末日聖徒イエス・キリスト教会の聖典学習グループのアナウンサーです。
以下は、グループメンバーが過去1週間に共有した（匿名の）学習ノートの内容です。
これらを分析し、グループ全体の「学習トレンド」や「深まっているテーマ」について、短く励ましとなるようなレポートを作成してください。
出力形式:
「今週の振り返り：」で始め、その後に分析結果を続けてください。
例：「今週の振り返り：今週はグループ全体で『祈り』についての学びが深まっているようです！多くのメンバーがアルマ書から主の憐れみについて感じています。」
特定の個人の名前や詳細なプライバシーには触れず、ポジティブな全体の傾向を伝えてください。
です・ます常体で、親しみやすく記述してください。

ノート内容:
${notesText}`;
    } else {
      prompt = `You are an announcer for a scripture study group of The Church of Jesus Christ of Latter-day Saints.
Below are the (anonymized) study notes shared by group members over the past week.
Analyze them and create a short, encouraging report on the group's "learning trends" or "deepening themes".
Output Format:
Start with "Weekly Reflection:", followed by your analysis.
Example: "Weekly Reflection: This week, the group seems to be deepening their understanding of 'Prayer'! Many members are feeling the Lord's mercy from the Book of Alma."
Do not mention specific individual names or private details. Focus on positive overall trends.
Keep it friendly and uplifting.

Notes Content:
${notesText}`;
    }

    const apiUrl = `${GEMINI_API_URL}?key=${process.env.GEMINI_API_KEY}`;

    const response = await axios.post(apiUrl, {
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    });

    const generatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error('No content generated from Gemini.');
    }

    // Save the system message
    const batch = db.batch();
    const newMessageRef = messagesRef.doc();
    batch.set(newMessageRef, {
      text: generatedText.trim(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      senderId: 'system',
      isSystemMessage: true,
      messageType: 'weeklyRecap',
      messageData: {
        weekOf: new Date().toISOString()
      }
    });

    // Update last generated timestamp
    batch.update(groupRef, {
      lastRecapGeneratedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();

    res.json({ message: 'Weekly recap generated successfully.', recap: generatedText });

  } catch (error) {
    console.error('Error generating weekly recap:', error.message);
    res.status(500).json({ error: 'Failed to generate recap.', details: error.message });
  }
});

app.post('/generate-personal-weekly-recap', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided.' });
  }
  const idToken = authHeader.split('Bearer ')[1];
  let verifiedUid;
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    verifiedUid = decodedToken.uid;
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token.' });
  }

  const { uid, language } = req.body;
  
  if (uid !== verifiedUid) {
    return res.status(403).json({ error: 'Forbidden: Cannot access another user\'s private data.' });
  }

  if (!uid) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  try {
    const notesRef = db.collection('users').doc(uid).collection('notes');

    // Calculate date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const timestamp7DaysAgo = admin.firestore.Timestamp.fromDate(sevenDaysAgo);

    // Query notes from last 7 days - Limit to 60 for speed
    const snapshot = await notesRef
      .where('createdAt', '>=', timestamp7DaysAgo)
      .limit(60)
      .get();

    const notes = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.comment) {
        notes.push(`[${data.scripture || 'Scripture'} - ${data.chapter || ''}] ${data.comment}`);
      } else if (data.text) {
        notes.push(data.text);
      }
    });

    if (notes.length === 0) {
      return res.status(200).json({ recap: null, message: 'No notes found for this week.' });
    }

    const langCode = language || 'en';
    let prompt = '';
    const notesText = notes.join("\n\n---\n\n");

    if (langCode === 'ja') {
      prompt = `あなたは個人の聖典学習のアシスタントです。
以下は、ユーザーが過去1週間に記録した学習ノートの内容です。
これらを分析し、ユーザーのための「個人的な学習の振り返り」を作成してください。
深まっているテーマ、繰り返し出てくる聖句、または感情の変化などに注目し、励ましとなるようなフィードバックをしてください。

出力形式:
タイトル：📅 今週の学習成果（${new Date().toLocaleDateString('ja-JP')}）
1. 深まったテーマ：
2. ピックアップ聖句：
3. 素晴らしい点：
4. 次週へのヒント：

です・ます常体で、親しみやすく記述してください。

ノート内容:
${notesText}`;
    } else {
      prompt = `You are a personal scripture study assistant.
Below are the study notes recorded by the user over the past week.
Analyze these and create a "Personal Study Reflection" for the user.
Focus on deepened themes, recurring scriptures, or changes in emotions, and provide encouraging feedback.

Output Format:
Title: 📅 Weekly Study Harvest (${new Date().toLocaleDateString()})
1. Deepened Themes:
2. Highlighted Scriptures:
3. What went well:
4. Tips for next week:

Keep the tone friendly, encouraging, and respectful.

Notes Content:
${notesText}`;
    }

    const apiUrl = `${GEMINI_API_URL}?key=${process.env.GEMINI_API_KEY}`;

    const response = await axios.post(apiUrl, {
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    });

    const generatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error('No content generated from Gemini.');
    }

    res.status(200).json({ recap: generatedText.trim() });

  } catch (error) {
    console.error('Error generating personal recap:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to generate personal recap.' });
  }
});

// Check Inactive Users (Cron Job)
app.get('/check-inactive-users', async (req, res) => {
  // Use a simple CRON_SECRET if available for security
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('Unauthorized access attempt to /check-inactive-users');
    // Allow for now if secret not set, or return 401
    if (cronSecret) return res.status(401).send('Unauthorized');
  }

  console.log('Starting inactivity check...');
  const db = admin.firestore();

  try {
    const groupsRef = db.collection('groups');
    const snapshot = await groupsRef.get();

    let processedCount = 0;
    let removedCount = 0;
    let initializedCount = 0;

    const BATCH_SIZE = 400;
    let batch = db.batch();
    let batchOpCount = 0;

    const now = new Date();
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

    for (const doc of snapshot.docs) {
      const groupData = doc.data();
      const groupId = doc.id;
      const members = groupData.members || [];
      const memberLastActive = groupData.memberLastActive || {};
      const ownerUserId = groupData.ownerUserId;

      console.log(`\nProcessing group ${groupId} (${groupData.name || 'Unnamed'}) with ${members.length} members`);

      if (members.length === 0) continue;

      let groupUpdates = {};
      let groupChanged = false;

      // Identify members to remove
      const membersToRemove = [];
      const membersToInitialize = [];


      for (const memberId of members) {
        // Skip owner
        if (memberId === ownerUserId) {
          console.log(`  Member ${memberId} is owner, skipping`);
          continue;
        }

        const lastActiveTimestamp = memberLastActive[memberId];
        const kickThreshold = (groupData.memberKickThresholds && groupData.memberKickThresholds[memberId]) || 3;
        const thresholdMs = kickThreshold * 24 * 60 * 60 * 1000;

        if (!lastActiveTimestamp) {
          // Initialize tracking if missing (giving them a fresh start)
          console.log(`  Member ${memberId} has no lastActive timestamp, initializing`);
          membersToInitialize.push(memberId);
        } else {
          const lastActiveDate = lastActiveTimestamp.toDate();
          const diff = now - lastActiveDate;
          const daysDiff = Math.floor(diff / (24 * 60 * 60 * 1000));

          console.log(`  Member ${memberId}: last active ${daysDiff} days ago (${lastActiveDate.toISOString()}), threshold: ${kickThreshold} days`);

          if (diff > thresholdMs) {
            console.log(`    ⚠️ Member ${memberId} is inactive (${daysDiff} days), marking for removal`);
            membersToRemove.push(memberId);
          } else {
            console.log(`    ✅ Member ${memberId} is active (${daysDiff} days)`);
          }
        }
      }

      // Handle Initializations
      if (membersToInitialize.length > 0) {
        const updateMap = {};
        membersToInitialize.forEach(uid => {
          updateMap[`memberLastActive.${uid}`] = admin.firestore.FieldValue.serverTimestamp();
        });
        Object.assign(groupUpdates, updateMap);
        groupChanged = true;
        initializedCount += membersToInitialize.length;
      }

      // Handle Removals
      if (membersToRemove.length > 0) {
        const removeUidList = membersToRemove;

        // Update Group Doc
        groupUpdates['members'] = admin.firestore.FieldValue.arrayRemove(...removeUidList);
        groupUpdates['membersCount'] = admin.firestore.FieldValue.increment(-removeUidList.length);

        removeUidList.forEach(uid => {
          groupUpdates[`memberLastActive.${uid}`] = admin.firestore.FieldValue.delete();
          groupUpdates[`memberKickThresholds.${uid}`] = admin.firestore.FieldValue.delete();
          groupUpdates[`memberJoinedAt.${uid}`] = admin.firestore.FieldValue.delete();
        });

        groupUpdates['messageCount'] = admin.firestore.FieldValue.increment(1);
        groupChanged = true;
        removedCount += removeUidList.length;

        // Add System Message
        const messageRef = groupsRef.doc(groupId).collection('messages').doc();
        batch.set(messageRef, {
          text: `👋 **${removeUidList.length} member(s)** were removed due to inactivity (3+ days).`,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          senderId: 'system',
          isSystemMessage: true,
          type: 'leave'
        });
        batchOpCount++;

        // Update Users
        for (const uid of removeUidList) {
          const userRef = db.collection('users').doc(uid);
          batch.update(userRef, {
            groupIds: admin.firestore.FieldValue.arrayRemove(groupId)
          });
          batchOpCount++;

          const groupStateRef = userRef.collection('groupStates').doc(groupId);
          batch.delete(groupStateRef);
          batchOpCount++;
        }
      }

      if (groupChanged) {
        batch.update(groupsRef.doc(groupId), groupUpdates);
        batchOpCount++;
      }

      if (batchOpCount > 300) {
        await batch.commit();
        batch = db.batch();
        batchOpCount = 0;
      }

      processedCount++;
    }

    if (batchOpCount > 0) {
      await batch.commit();
    }

    res.json({
      message: 'Inactivity check complete.',
      stats: { processedGroups: processedCount, removedUsers: removedCount, initializedTracking: initializedCount }
    });

  } catch (error) {
    console.error('Error in inactivity check:', error);
    res.status(500).send('Error checking inactivity: ' + error.message);
  }



});

// Manual Test Endpoint for Debugging Inactivity (specific group)
app.get('/test-inactive-check/:groupId', async (req, res) => {
  const { groupId } = req.params;

  console.log(`\n🔍 Manual inactivity check for group: ${groupId}`);
  const db = admin.firestore();

  try {
    const groupRef = db.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const groupData = groupDoc.data();
    const members = groupData.members || [];
    const memberLastActive = groupData.memberLastActive || {};
    const ownerUserId = groupData.ownerUserId;

    const now = new Date();
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

    const report = {
      groupId,
      groupName: groupData.name,
      totalMembers: members.length,
      ownerUserId,
      checkTime: now.toISOString(),
      members: []
    };

    for (const memberId of members) {
      const memberInfo = {
        memberId,
        isOwner: memberId === ownerUserId
      };

      if (memberId === ownerUserId) {
        memberInfo.status = 'Owner (skipped)';
        memberInfo.action = 'none';
      } else {
        const lastActiveTimestamp = memberLastActive[memberId];

        if (!lastActiveTimestamp) {
          memberInfo.status = 'No tracking data';
          memberInfo.action = 'would initialize';
          memberInfo.lastActive = null;
          memberInfo.daysSinceActive = null;
        } else {
          const lastActiveDate = lastActiveTimestamp.toDate();
          const diff = now - lastActiveDate;
          const daysDiff = Math.floor(diff / (24 * 60 * 60 * 1000));
          const kickThreshold = (groupData.memberKickThresholds && groupData.memberKickThresholds[memberId]) || 3;
          const thresholdMs = kickThreshold * 24 * 60 * 60 * 1000;

          memberInfo.lastActive = lastActiveDate.toISOString();
          memberInfo.daysSinceActive = daysDiff;
          memberInfo.kickThreshold = kickThreshold;
          memberInfo.status = diff > thresholdMs ? '⚠️ Inactive' : '✅ Active';
          memberInfo.action = diff > thresholdMs ? 'would remove' : 'keep';
        }
      }

      report.members.push(memberInfo);
    }

    res.json(report);

  } catch (error) {
    console.error('Error in test inactive check:', error);
    res.status(500).json({ error: error.message });
  }
});


app.post('/test-push-notification', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send('Unauthorized: No token provided.');
  }
  const idToken = authHeader.split('Bearer ')[1];
  let verifiedUid;
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    verifiedUid = decodedToken.uid;
  } catch (err) {
    return res.status(401).send('Unauthorized: Invalid token.');
  }

  const { userId, title, body } = req.body;
  if (!userId) return res.status(400).send('userId is required');

  if (userId !== verifiedUid) {
    return res.status(403).send('Forbidden: Cannot send push notification to another user.');
  }

  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return res.status(404).send('User not found');

    const tokens = await getUserFcmTokens(userId);

    if (tokens.length === 0) {
      return res.status(400).send('No FCM tokens found for this user');
    }

    const response = await sendPushNotification(tokens, {
      title: title || 'Test Notification',
      body: body || 'This is a test notification from Scripture Habit!',
      data: { type: 'test' }
    });

    res.json({ message: 'Push notification sent', response });
  } catch (error) {
    console.error('Error in test push notification:', error);
    res.status(500).send(error.message);
  }
});

app.post('/send-cheer', async (req, res) => {
  console.log('--- POST SEND-CHEER REQUEST RECEIVED ---');
  console.log('Request Body:', JSON.stringify(req.body, null, 2));

  const validation = sendCheerSchema.safeParse(req.body);
  if (!validation.success) {
    console.error('Validation failed:', JSON.stringify(validation.error.format(), null, 2));
    return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });
  }

  const { targetUid, groupId, senderNickname, language } = validation.data;

  const authHeader = req.headers.authorization;
  let idToken;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    idToken = authHeader.split('Bearer ')[1];
  } else {
    return res.status(401).send('Unauthorized: No token provided.');
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const senderUid = decodedToken.uid;

    if (senderUid === targetUid) {
      console.warn(`User ${senderUid} tried to cheer themselves.`);
      return res.status(400).json({ error: 'You cannot cheer yourself.' });
    }

    const senderDoc = await db.collection('users').doc(senderUid).get();
    const senderData = senderDoc.data() || {};

    let timeZone = 'UTC';
    try {
      if (senderData.timeZone) {
        Intl.DateTimeFormat(undefined, { timeZone: senderData.timeZone });
        timeZone = senderData.timeZone;
      }
    } catch (tzError) {
      console.warn(`Invalid timezone ${senderData.timeZone}, falling back to UTC`);
    }

    const today = new Date().toLocaleDateString('en-CA', { timeZone });
    const cheerDocId = `cheer_${senderUid}_${targetUid}_${today}`;
    const cheerRef = db.collection('cheers').doc(cheerDocId);

    const existingCheer = await cheerRef.get();
    if (existingCheer.exists) {
      return res.status(429).json({ error: 'alreadySent' });
    }

    const targetUserDoc = await db.collection('users').doc(targetUid).get();
    if (!targetUserDoc.exists) {
      return res.status(404).json({ error: 'Target user not found.' });
    }

    const targetData = targetUserDoc.data();
    const tokens = await getUserFcmTokens(targetUid);

    // Random message templates
    const lang = language || targetData.language || 'en';
    const templates = CHEER_NOTIFICATION_TEMPLATES[lang] || CHEER_NOTIFICATION_TEMPLATES['en'];
    const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
    const body = randomTemplate.replace('{nickname}', senderNickname);

    const titleMap = {
      ja: '💪 エールが届きました！',
      en: '💪 You received a cheer!',
      es: '💪 ¡Recibiste un apoyo!',
      pt: '💪 Você recebeu um incentivo!',
      ko: '💪 응원이 도착했습니다!',
      zho: '💪 您收到了一份鼓勵！',
      vi: '💪 Bạn đã nhận được lời khích lệ!',
      th: '💪 คุณได้รับกำลังใจ!',
      tl: '💪 Nakatanggap ka ng cheer!',
      sw: '💪 Umepokea ushangiliaji!'
    };
    const title = titleMap[lang] || titleMap['en'];

    if (tokens.length > 0) {
      const payload = {
        title,
        body,
        data: {
          type: 'cheer',
          senderUid,
          senderNickname,
          groupId,
          openNewNote: 'true'
        }
      };
      await sendPushNotification(tokens, payload);
    }

    await cheerRef.set({
      senderUid,
      targetUid,
      groupId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      date: today
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error in send-cheer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/fetch-gc-metadata', async (req, res) => {
  const { url, lang } = req.query;

  if (!url) return res.status(400).send({ error: 'URL is required' });

  try {
    let targetUrl;
    try {
      targetUrl = new URL(url);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    if (targetUrl.hostname !== 'www.churchofjesuschrist.org' && targetUrl.hostname !== 'churchofjesuschrist.org') {
      return res.status(400).json({ error: 'Invalid URL domain.' });
    }

    if (lang) {
      targetUrl.searchParams.set('lang', lang);
    }

    let response;
    try {
      response = await axios.get(targetUrl.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000
      });
    } catch (axiosError) {
      if (lang) {
        try {
          targetUrl.searchParams.delete('lang');
          response = await axios.get(targetUrl.toString(), {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000
          });
        } catch (fallbackError) {
          return res.json({ title: '', speaker: '' });
        }
      } else {
        return res.json({ title: '', speaker: '' });
      }
    }

    if (!response || !response.data) {
      return res.json({ title: '', speaker: '' });
    }

    const $ = cheerio.load(response.data);
    let title = $('meta[property="og:title"]').attr('content');
    if (!title) {
      const h1Text = $('h1').first().text().trim();
      if (h1Text && h1Text.length < 200) title = h1Text;
    }
    if (!title) {
      title = $('title').text().trim();
      if (title.includes('|')) title = title.split('|')[0].trim();
    }

    let speaker = '';
    if ($('div.byline p.author-name').length) {
      speaker = $('div.byline p.author-name').first().text().trim();
    } else if ($('p.author-name').length) {
      speaker = $('p.author-name').first().text().trim();
    }

    if (speaker) {
      speaker = speaker.replace(/^(By|Par|De|Por)\s+/i, '').trim();
    }

    res.json({ title: title || '', speaker });
  } catch (error) {
    console.error('Error scraping GC:', error.message);
    res.json({ title: '', speaker: '' });
  }
});

app.get('/url-preview', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const { url, lang } = req.query;

  if (!url) return res.status(400).json({ error: 'URL parameter is required' });

  try {
    const parsedUrl = new URL(url);

    // Basic SSRF protection
    const hostname = parsedUrl.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('169.254.') ||
      hostname.startsWith('10.') ||
      hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./) ||
      hostname.startsWith('192.168.') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local')
    ) {
      return res.status(400).json({ error: 'URL is not allowed for security reasons.' });
    }

    const isChurchUrl = hostname.includes('churchofjesuschrist.org') || hostname.includes('general-conference');

    if (lang && isChurchUrl) {
      const currentLang = parsedUrl.searchParams.get('lang');
      if (!currentLang ||
        (lang === 'ja' && currentLang === 'jpn') ||
        (lang === 'jpn' && currentLang === 'ja')) {
        parsedUrl.searchParams.set('lang', lang);
      }
    }

    const fetchWithLang = async (targetUrl, targetLang) => {
      const u = new URL(targetUrl);
      if (targetLang) u.searchParams.set('lang', targetLang);
      return axios.get(u.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        },
        timeout: 10000
      });
    };

    let response;
    try {
      response = await fetchWithLang(parsedUrl.toString());
    } catch (err) {
      if (err.response?.status === 404 && isChurchUrl) {
        try {
          const altLang = (parsedUrl.searchParams.get('lang') === 'jpn' ? 'ja' : 'jpn');
          response = await fetchWithLang(parsedUrl.toString(), altLang);
        } catch (err2) {
          if (err2.response?.status === 404) {
            const noLangUrl = new URL(parsedUrl.toString());
            noLangUrl.searchParams.delete('lang');
            response = await fetchWithLang(noLangUrl.toString());
          } else throw err2;
        }
      } else throw err;
    }

    const $ = cheerio.load(response.data);

    // 1. Specialized Title Extraction
    let title = '';
    if (isChurchUrl) {
      title = $('meta[property="og:title"]').attr('content') ||
        $('h1').first().text().trim() ||
        $('title').text().trim();
      if (title.includes(' | ')) title = title.split(' | ')[0];
    } else {
      title = $('meta[property="og:title"]').attr('content') ||
        $('meta[name="twitter:title"]').attr('content') ||
        $('title').text().trim() ||
        $('h1').first().text().trim();
    }

    // 2. Specialized Speaker Extraction
    let speaker = '';
    if (isChurchUrl) {
      speaker = $('div.byline p.author-name').first().text().trim() ||
        $('p.author-name').first().text().trim() ||
        $('a.author-name').first().text().trim();
      if (speaker) {
        speaker = speaker.replace(/^(By|Par|De|Por)\s+/i, '').trim();
      }
    }

    let displayTitle = title;
    if (speaker && displayTitle && !displayTitle.includes(speaker)) {
      displayTitle = `${title} (${speaker})`;
    }

    const description = $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      null;

    let image = $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content');
    if (image && !image.startsWith('http')) {
      image = new URL(image, url).href;
    }

    const siteName = $('meta[property="og:site_name"]').attr('content') ||
      (isChurchUrl ? 'Church of Jesus Christ' : parsedUrl.hostname);

    let favicon = $('link[rel="shortcut icon"]').attr('href') ||
      $('link[rel="icon"]').attr('href') ||
      `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=64`;

    if (favicon && !favicon.startsWith('http')) {
      favicon = new URL(favicon, url).href;
    }



    res.json({
      url,
      title: (displayTitle ? displayTitle.trim() : parsedUrl.hostname),
      description: description ? description.trim() : null,
      image,
      favicon,
      siteName: siteName
    });
  } catch (error) {
    console.error('Error fetching URL preview:', error.message);
    try {
      const parsedUrl = new URL(url);
      res.json({
        url,
        title: parsedUrl.hostname,
        description: null,
        image: null,
        favicon: `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=64`,
        siteName: parsedUrl.hostname
      });
    } catch {
      res.status(400).json({ error: 'Invalid URL' });
    }
  }
});

// Delete entire user account - cleaner than doing it only on client
app.post('/delete-account', async (req, res) => {
  const authHeader = req.headers.authorization;
  let idToken;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    idToken = authHeader.split('Bearer ')[1];
  } else {
    return res.status(401).send('Unauthorized');
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const db = admin.firestore();

    console.log(`Starting account deletion for UID: ${uid}`);

    // --- STEP 1: Get User Data for Cleanup ---
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      const groupIds = userData.groupIds || (userData.groupId ? [userData.groupId] : []);

      // --- STEP 2: Exit Groups ---
      for (const gid of groupIds) {
        try {
          const groupRef = db.collection('groups').doc(gid);
          await db.runTransaction(async (transaction) => {
            const gSnap = await transaction.get(groupRef);
            if (!gSnap.exists) return;

            const gData = gSnap.data();
            const members = gData.members || [];
            const updatedMembers = members.filter(mUid => mUid !== uid);

            if (gData.ownerUserId === uid) {
              if (updatedMembers.length > 0) {
                // Transfer ownership
                transaction.update(groupRef, {
                  ownerUserId: updatedMembers[0],
                  members: updatedMembers,
                  membersCount: admin.firestore.FieldValue.increment(-1),
                  [`memberKickThresholds.${uid}`]: admin.firestore.FieldValue.delete()
                });
              } else {
                // Delete group if no one left
                transaction.delete(groupRef);
              }
            } else {
              // Just leave
              transaction.update(groupRef, {
                members: updatedMembers,
                membersCount: admin.firestore.FieldValue.increment(-1),
                [`memberKickThresholds.${uid}`]: admin.firestore.FieldValue.delete()
              });
            }
          });
        } catch (groupError) {
          console.error(`Group cleanup failed for ${gid}:`, groupError.message);
        }
      }

      // --- STEP 3: Delete Subcollections (Notes, etc.) ---
      const subcollections = ['notes', 'groupStates', 'letters'];
      for (const sub of subcollections) {
        let snapshot = await userRef.collection(sub).get();
        while (!snapshot.empty) {
          const batch = db.batch();
          // Process in chunks of 500 (Firestore limit)
          const docsToDelete = snapshot.docs.slice(0, 500);
          docsToDelete.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
          
          if (snapshot.docs.length <= 500) break;
          snapshot = await userRef.collection(sub).get();
        }
      }

      // --- STEP 4: Delete User Profile ---
      await userRef.delete();
    }

    // --- STEP 5: Delete from Firebase Auth ---
    await admin.auth().deleteUser(uid);
    
    console.log(`Successfully deleted account and data for UID: ${uid}`);
    res.status(200).json({ message: 'Account and all data deleted successfully.' });

  } catch (error) {
    console.error('Error in /delete-account:', error);
    res.status(500).json({ error: 'Failed to delete account.', details: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT} `);
});