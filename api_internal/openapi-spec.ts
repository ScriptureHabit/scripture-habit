const openapiSpec = {
  "openapi": "3.0.0",
  "info": {
    "title": "Scripture Habit API",
    "version": "1.0.0",
    "description": "Scripture Habit internal backend APIs for User Profiles, Group Chat, AI Translation & Weekly Recaps, 1-Min Sandbox Demo, Cron Jobs, Safety Reporting, and Link Previews. Making daily scripture study more fun and meaningful."
  },
  "servers": [
    {
      "url": "/",
      "description": "Current Environment Server"
    }
  ],
  "components": {
    "securitySchemes": {
      "bearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "Firebase ID Token in Authorization header: Bearer <token>"
      },
      "appCheck": {
        "type": "apiKey",
        "in": "header",
        "name": "X-Firebase-AppCheck",
        "description": "Firebase AppCheck Token"
      },
      "cronSecret": {
        "type": "http",
        "scheme": "bearer",
        "description": "Cron Secret in Authorization header: Bearer <CRON_SECRET>"
      }
    }
  },
  "security": [
    {
      "bearerAuth": [],
      "appCheck": []
    }
  ],
  "paths": {
    "/api/auth/initialize-profile": {
      "post": {
        "tags": ["Auth & Profile"],
        "summary": "Initialize User Profile",
        "description": "Initializes a new user profile document upon initial sign-up.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "nickname": { "type": "string", "example": "Daijiro" },
                  "timeZone": { "type": "string", "example": "Asia/Tokyo" },
                  "language": { "type": "string", "example": "ja" }
                }
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Profile initialized successfully",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": { "type": "boolean", "example": true },
                    "message": { "type": "string", "example": "Profile initialized successfully." }
                  }
                }
              }
            }
          },
          "400": { "description": "Validation Error" },
          "401": { "description": "Unauthorized" }
        }
      }
    },
    "/api/auth/update-profile": {
      "post": {
        "tags": ["Auth & Profile"],
        "summary": "Update User Profile",
        "description": "Updates nickname, photoURL, stake/ward, bio, language, or tutorial flags, and syncs changes to chats.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "nickname": { "type": "string", "example": "Daijiro" },
                  "photoURL": { "type": "string", "example": "https://example.com/avatar.jpg" },
                  "stake": { "type": "string", "example": "Tokyo Stake" },
                  "ward": { "type": "string", "example": "Shinjuku Ward" },
                  "language": { "type": "string", "example": "ja" },
                  "bio": { "type": "string", "example": "Daily scripture reader" },
                  "hasSeenTour": { "type": "boolean", "example": true }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Profile successfully updated",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": { "type": "boolean", "example": true },
                    "message": { "type": "string", "example": "Profile updated and synced." }
                  }
                }
              }
            }
          },
          "400": { "description": "Invalid input / Validation Error" },
          "401": { "description": "Unauthorized" }
        }
      }
    },
    "/api/auth/verify-login": {
      "post": {
        "tags": ["Auth & Profile"],
        "summary": "Verify User Login",
        "description": "Verifies that the user's email is verified and prevents disallowed test accounts in production.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["token"],
                "properties": {
                  "token": { "type": "string", "example": "firebase-id-token..." }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Login verified successfully",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "message": { "type": "string", "example": "Login verified." },
                    "uid": { "type": "string", "example": "usr_12345" },
                    "email": { "type": "string", "example": "user@example.com" }
                  }
                }
              }
            }
          },
          "403": { "description": "Email not verified or forbidden domain" }
        }
      }
    },
    "/api/auth/delete-account": {
      "post": {
        "tags": ["Auth & Profile"],
        "summary": "Delete User Account",
        "description": "Completely deletes user account, exits groups, purges reactions, and recursively removes private data.",
        "responses": {
          "200": {
            "description": "Account and all data deleted successfully",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "message": { "type": "string", "example": "Account and all data deleted successfully." }
                  }
                }
              }
            }
          },
          "401": { "description": "Unauthorized" }
        }
      }
    },
    "/api/groups": {
      "get": {
        "tags": ["Groups & Chat"],
        "summary": "Fetch Public Groups",
        "description": "Retrieves public groups with member previews and latest activity for joining. Auto-seeds demo group for demo users.",
        "parameters": [
          {
            "name": "limit",
            "in": "query",
            "required": false,
            "schema": { "type": "integer", "default": 20 }
          },
          {
            "name": "lastId",
            "in": "query",
            "required": false,
            "schema": { "type": "string" }
          }
        ],
        "responses": {
          "200": {
            "description": "List of public groups",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": { "type": "object" }
                }
              }
            }
          },
          "401": { "description": "Unauthorized" }
        }
      }
    },
    "/api/groups/create-group": {
      "post": {
        "tags": ["Groups & Chat"],
        "summary": "Create New Group",
        "description": "Creates a new habit study group (Owner receives owner permissions). Enforces group limits.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["name"],
                "properties": {
                  "name": { "type": "string", "example": "Tokyo Scripture Group" },
                  "description": { "type": "string", "example": "Let's read daily at 7 AM" },
                  "timeZone": { "type": "string", "example": "Asia/Tokyo" }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Group created successfully",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "groupId": { "type": "string", "example": "grp_abc123" },
                    "inviteCode": { "type": "string", "example": "XYZ789" }
                  }
                }
              }
            }
          },
          "400": { "description": "Group limit reached or invalid input" },
          "401": { "description": "Unauthorized" }
        }
      }
    },
    "/api/groups/create-ai-group": {
      "post": {
        "tags": ["Groups & Chat"],
        "summary": "Create AI Study Companion Group",
        "description": "Creates a dedicated 1-on-1 habit group with Scripture Habit AI Companion.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "name": { "type": "string", "example": "Scripture Habit AI" },
                  "timeZone": { "type": "string", "example": "Asia/Tokyo" }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "AI group created successfully",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "groupId": { "type": "string", "example": "grp_ai123" },
                    "groupName": { "type": "string", "example": "Scripture Habit AI" },
                    "inviteCode": { "type": "string", "example": "AI7890" }
                  }
                }
              }
            }
          },
          "400": { "description": "Group limit reached" }
        }
      }
    },
    "/api/groups/join-group": {
      "post": {
        "tags": ["Groups & Chat"],
        "summary": "Join Group by Invite Code",
        "description": "Adds current user to a private group using an invite code.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["inviteCode"],
                "properties": {
                  "inviteCode": { "type": "string", "example": "XYZ789" }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Successfully joined group",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "gid": { "type": "string", "example": "grp_abc123" },
                    "groupName": { "type": "string", "example": "Tokyo Group" }
                  }
                }
              }
            }
          },
          "400": { "description": "Group is full or already joined" },
          "404": { "description": "Group or Invite Code not found" }
        }
      }
    },
    "/api/groups/leave-group": {
      "post": {
        "tags": ["Groups & Chat"],
        "summary": "Leave Group",
        "description": "Removes current user from the specified group and safely transfers ownership if owner leaves.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["groupId"],
                "properties": {
                  "groupId": { "type": "string", "example": "grp_abc123" }
                }
              }
            }
          }
        },
        "responses": {
          "200": { "description": "Successfully left the group" }
        }
      }
    },
    "/api/groups/post-note": {
      "post": {
        "tags": ["Groups & Chat"],
        "summary": "Post Study Note",
        "description": "Saves daily study note, calculates consecutive streaks, updates unity scores across member groups, and syncs note to chat.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["chapter", "comment"],
                "properties": {
                  "category": { "type": "string", "example": "Book of Mormon" },
                  "chapter": { "type": "string", "example": "1 Nephi 3:7" },
                  "comment": { "type": "string", "example": "I learned the importance of moving forward with faith." },
                  "shareOption": { "type": "string", "enum": ["all", "none", "specific"], "example": "all" },
                  "selectedShareGroups": { "type": "array", "items": { "type": "string" }, "example": ["grp_123"] }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Note posted successfully",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": { "type": "boolean", "example": true },
                    "streakCount": { "type": "integer", "example": 10 }
                  }
                }
              }
            }
          },
          "400": { "description": "Validation Error" }
        }
      }
    },
    "/api/groups/post-message": {
      "post": {
        "tags": ["Groups & Chat"],
        "summary": "Post Message to Group",
        "description": "Posts a chat message or reply to a group. Broadcasts push notifications to group members.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["groupId", "text"],
                "properties": {
                  "groupId": { "type": "string", "example": "grp_abc123" },
                  "text": { "type": "string", "example": "Had great insights today as well!" },
                  "optimisticId": { "type": "string", "example": "temp-1700000000" }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Message posted successfully",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "messageId": { "type": "string", "example": "msg_789" }
                  }
                }
              }
            }
          },
          "403": { "description": "Forbidden (User is not a member)" }
        }
      }
    },
    "/api/groups/regenerate-invite-code": {
      "post": {
        "tags": ["Groups & Chat"],
        "summary": "Regenerate Invite Code",
        "description": "Generates a fresh 6-character alphanumeric invite code for a group (Owner only).",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["groupId"],
                "properties": {
                  "groupId": { "type": "string", "example": "grp_abc123" },
                  "expiryDays": { "type": "integer", "example": 7 }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "New invite code generated",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": { "type": "boolean", "example": true },
                    "inviteCode": { "type": "string", "example": "K8M2PQ" },
                    "expiresAt": { "type": "string", "example": "2026-08-23T12:00:00.000Z" }
                  }
                }
              }
            }
          },
          "403": { "description": "Forbidden (Owner only)" }
        }
      }
    },
    "/api/groups/bundle/{groupId}": {
      "get": {
        "tags": ["Groups & Chat"],
        "summary": "Get Firestore Bundle for Group Messages",
        "description": "Fetches pre-packaged binary Firestore Bundle containing recent group messages for fast single-Read initial load.",
        "parameters": [
          {
            "name": "groupId",
            "in": "path",
            "required": true,
            "schema": { "type": "string" },
            "example": "grp_abc123"
          }
        ],
        "responses": {
          "200": {
            "description": "Binary Firestore Bundle stream",
            "content": {
              "application/octet-stream": {}
            }
          },
          "403": { "description": "Forbidden (Not a group member)" }
        }
      }
    },
    "/api/ai/translate": {
      "post": {
        "tags": ["AI & Translation"],
        "summary": "Translate Text via AI",
        "description": "Asynchronously translates text or user nicknames using Gemini AI with caching.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["text", "targetLanguage"],
                "properties": {
                  "text": { "type": "string", "example": "Hello! Let's read scriptures together." },
                  "targetLanguage": { "type": "string", "example": "en" },
                  "updateType": { "type": "string", "example": "user_nickname" },
                  "groupId": { "type": "string", "example": "group_123" }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Translation successful",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "translatedText": { "type": "string", "example": "Hello! Let's read scriptures together." }
                  }
                }
              }
            }
          },
          "401": { "description": "Unauthorized" }
        }
      }
    },
    "/api/ai/translate-batch": {
      "post": {
        "tags": ["AI & Translation"],
        "summary": "Batch Translate Messages via AI",
        "description": "Translates multiple chat messages in a single batch request for efficiency.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["messages", "targetLanguage"],
                "properties": {
                  "targetLanguage": { "type": "string", "example": "en" },
                  "messages": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "required": ["id", "text"],
                      "properties": {
                        "id": { "type": "string", "example": "msg_001" },
                        "text": { "type": "string", "example": "I read 1 Nephi Chapter 3." }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Batch translation successful",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "translations": {
                      "type": "object",
                      "additionalProperties": { "type": "string" },
                      "example": { "msg_001": "I read 1 Nephi Chapter 3." }
                    }
                  }
                }
              }
            }
          },
          "400": { "description": "Invalid input / Validation Error" },
          "401": { "description": "Unauthorized" }
        }
      }
    },
    "/api/ai/generate-personal-weekly-recap": {
      "post": {
        "tags": ["AI & Translation"],
        "summary": "Generate Personal Weekly Recap",
        "description": "Generates AI-powered weekly study recap and reflection encouragement based on recent study notes.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "language": { "type": "string", "example": "ja" },
                  "forceRefresh": { "type": "boolean", "example": false }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Weekly recap generated successfully",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "recapText": { "type": "string", "example": "We had wonderful learnings about Nephi's faith this week!" }
                  }
                }
              }
            }
          },
          "401": { "description": "Unauthorized" }
        }
      }
    },
    "/api/demo/initialize": {
      "post": {
        "tags": ["Demo Sandbox"],
        "summary": "Initialize 1-Min Demo Sandbox",
        "description": "Initializes an isolated, simulated 999-day streak environment with bot group members for instant browser demos.",
        "requestBody": {
          "required": false,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "language": { "type": "string", "example": "ja" }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Demo environment successfully seeded",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": { "type": "boolean", "example": true },
                    "groupId": { "type": "string", "example": "demo-group-usr_123" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/report/report": {
      "post": {
        "tags": ["Reports & Safety"],
        "summary": "Submit User or Message Report",
        "description": "Submits a safety report to Firestore and alerts moderation via Discord Webhook.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["reason"],
                "properties": {
                  "groupId": { "type": "string", "example": "grp_abc123" },
                  "reportedUserId": { "type": "string", "example": "user_789" },
                  "reportedUserNickname": { "type": "string", "example": "Bob" },
                  "messageId": { "type": "string", "example": "msg_456" },
                  "messageText": { "type": "string", "example": "Reported content..." },
                  "reason": { "type": "string", "example": "Inappropriate language" }
                }
              }
            }
          }
        },
        "responses": {
          "200": { "description": "Report successfully submitted" }
        }
      }
    },
    "/api/preview/fetch-church-metadata": {
      "get": {
        "tags": ["Link Preview"],
        "summary": "Fetch Church Article Metadata",
        "description": "Fetches OGP metadata for official Church of Jesus Christ of Latter-day Saints article links with SSRF protection.",
        "parameters": [
          {
            "name": "url",
            "in": "query",
            "required": true,
            "schema": { "type": "string" },
            "example": "https://www.churchofjesuschrist.org/study/scriptures/bofm/1-ne/3?lang=jpn"
          },
          {
            "name": "language",
            "in": "query",
            "required": false,
            "schema": { "type": "string" },
            "example": "jpn"
          }
        ],
        "responses": {
          "200": {
            "description": "Metadata retrieved successfully",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "title": { "type": "string", "example": "1 Nephi 3" },
                    "description": { "type": "string", "example": "Nephi and his brothers return to Jerusalem..." },
                    "image": { "type": "string", "example": "https://example.com/ogp.jpg" }
                  }
                }
              }
            }
          },
          "400": { "description": "Invalid URL or blocked non-allowed domain" }
        }
      }
    },
    "/api/cron/streak-reminder": {
      "post": {
        "tags": ["Cron & Maintenance"],
        "summary": "Trigger Streak Reminders",
        "description": "Scans users nearing streak expiration and dispatches FCM push notifications.",
        "security": [
          { "cronSecret": [] }
        ],
        "responses": {
          "200": {
            "description": "Streak reminders processed successfully",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "sent": { "type": "integer", "example": 15 },
                    "skipped": { "type": "integer", "example": 120 }
                  }
                }
              }
            }
          },
          "401": { "description": "Unauthorized (Invalid CRON_SECRET)" }
        }
      }
    },
    "/api/cron/check-inactive-users": {
      "all": {
        "tags": ["Cron & Maintenance"],
        "summary": "Check Inactive Users",
        "description": "Evaluates member inactivity thresholds and automatically removes inactive members if threshold is breached.",
        "security": [
          { "cronSecret": [] }
        ],
        "responses": {
          "200": { "description": "Inactivity check complete" },
          "401": { "description": "Unauthorized" }
        }
      }
    },
    "/api/groups/reset-unity-if-midnight": {
      "post": {
        "tags": ["Cron & Maintenance"],
        "summary": "Reset Group Unity on Midnight",
        "description": "Resets the daily unity percentage for a group if midnight in the group's time zone has passed.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["groupId"],
                "properties": {
                  "groupId": { "type": "string", "example": "grp_abc123" }
                }
              }
            }
          }
        },
        "responses": {
          "200": { "description": "Unity reset status checked" },
          "403": { "description": "Not a group member" }
        }
      }
    }
  }
};

export default openapiSpec;
