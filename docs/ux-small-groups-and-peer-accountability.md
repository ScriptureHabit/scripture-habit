# Small Group Dynamics (Max 5) & Peer Accountability

Scripture Habit's group system is built around a **maximum of 5 members per group (`maxMembers: 5`)**.

Furthermore, observations from production usage have shown that **groups composed of close friends, romantic partners, or family members tend to maintain high retention over time, whereas groups formed among strangers or loose acquaintances often struggle to stay active.**

This document explores why the 5-member limit is effective for daily habit formation, and how relational context influences long-term engagement.

---

## 1. Why Cap Groups at 5 Members?

While many social platforms support large groups with dozens or hundreds of members, large group sizes present several challenges for daily personal reflection and habit building:

```mermaid
flowchart TD
    classDef good fill:#064e3b,stroke:#10b981,stroke-width:2px,color:#f0fdf4;
    classDef bad fill:#450a0a,stroke:#ef4444,stroke-width:2px,color:#fef2f2;
    classDef step fill:#1e293b,stroke:#64748b,stroke-width:1.5px,color:#f8fafc;

    subgraph SG_Large["❌ Large Groups (20-100 members)"]
        A1["Too Many Members"]:::step --> B1["Assumption that someone else will post"]:::step
        B1 --> C1["Hesitation to participate or react"]:::step
        C1 --> D1["Group goes quiet and inactive"]:::bad
    end

    subgraph SG_Habit["✅ Scripture Habit (Max 5-Member Circles)"]
        A2["5-Member Micro-Group"]:::step --> B2["Participation is clearly visible"]:::step
        B2 --> C2["Easy to cheer and encourage each other"]:::step
        C2 --> D2["Habits stay active together"]:::good
    end

    SG_Large ~~~ SG_Habit
```

### ① Mitigating Social Loafing (The Ringelmann Effect)
As group size increases, individual sense of responsibility often decreases because people assume their contribution won't make much difference to the whole.
In a large chat, skipping a day easily goes unnoticed. **In a 5-person circle, each member's presence matters, providing natural, positive peer accountability.**

### ② Reducing the Bystander Effect
In crowded chatrooms, people frequently wait for someone else to respond, resulting in collective silence.
In a small group of 5, members naturally feel more involved, making it easier to share reactions, cheers, and words of encouragement.

### ③ Staying Within Close Relational Capacity (Dunbar's Number)
Anthropological research suggests that the number of people with whom an individual can maintain close, unpretentious relationships is around 5 (the "Support Clique").

---

## 2. The Influence of Pre-Existing Relationships on Retention

In practice, **the relationship between group members is a key factor in how long a group remains active**:

```mermaid
flowchart TD
    classDef good fill:#064e3b,stroke:#10b981,stroke-width:2px,color:#f0fdf4;
    classDef bad fill:#450a0a,stroke:#ef4444,stroke-width:2px,color:#fef2f2;
    classDef step fill:#1e293b,stroke:#64748b,stroke-width:1.5px,color:#f8fafc;

    subgraph SG_Close["✨ Close Friends, Partners & Family (High Retention)"]
        ST1["Established Trust"]:::step --> ST2["Comfortable sharing short or unpolished notes"]:::step
        ST2 --> ST3["Enjoying seeing loved ones study"]:::step
        ST3 --> ST4["🌟 High Long-Term Retention & Consistency"]:::good
    end

    subgraph SG_Strangers["⚠️ Strangers & Loose Acquaintances (High Dropout)"]
        WT1["Unfamiliar with Each Other"]:::step --> WT2["Pressure to sound formal or profound"]:::step
        WT2 --> WT3["One member goes quiet, others follow"]:::step
        WT3 --> WT4["❌ Groups easily fade into silence"]:::bad
    end

    SG_Close ~~~ SG_Strangers
```

### ① Why Close Friend and Family Groups Last
- **Psychological Safety**:
  Close friends and partners don't worry about being judged for short or simple notes. A quick one-sentence reflection can be shared without hesitation.
- **Mutual Encouragement**:
  Seeing someone you care about study daily serves as natural motivation: *"If they found time today, I'd like to read as well."*

### ② Challenges Faced by Groups of Strangers
- **Pressure to Sound Formal**:
  When sharing with strangers, people often feel the need to write well-composed essays, which raises the friction of posting.
- **Cascading Inactivity**:
  If one stranger stops posting, others may conclude that the group is inactive and gradually stop posting as well.

---

## 3. Product Strategies in Scripture Habit

To support healthy group interaction, Scripture Habit incorporates several design choices:

| Mechanism | Purpose |
| :--- | :--- |
| **5-Member Cap (`maxMembers: 5`)** | Keeps groups intimate so every member's participation is recognized. |
| **Direct Invite Links** | Makes it easy to invite a spouse, close friend, or family member to study together. |
| **AI Partner Group (Dedicated 1-on-1 Space)** | Provides a private 1-on-1 space with the AI partner bot for users who prefer studying independently without peer pressure. |
| **Unity Sync (Team Participation)** | Focuses on shared completion percentage rather than competitive individual rankings. |
| **Inactivity Auto-Kick** | Gently removes inactive members over time so groups remain fresh and active. |

---

## 4. Summary

Building a lasting habit depends not just on individual willpower, but on **the people sharing the journey**.

Scripture Habit is designed not as a large public network, but as a **supportive, comfortable space for up to 5 people** to encourage each other along the way.

---

## 5. Related Documentation

- [Psychological Impact & Retention of AI Reflection Letters](./ux-ai-reflection-letters.md)
- [Milestone Celebrations & Retention Psychology](./logic-milestone-retention.md)
- [Group Chat Construction Guide](./groupchat-construction-guide.md)
- [Group Invites & Joining Pipeline](./group-invites.md)
- [Inactivity & Auto-Kick Engine](./inactivity-and-autokick.md)
- [Unity & Daily Participation](./unity-participation.md)
