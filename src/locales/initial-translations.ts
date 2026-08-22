// Lightweight fallback translations for landing page and critical initial UI
// (~3.5 KB) so initial render is instantaneous without waiting for full locale files (~57 KB)
export const initialEnTranslations = {
    "common": {
        "cancel": "Cancel",
        "save": "Save",
        "delete": "Delete",
        "edit": "Edit",
        "close": "Close",
        "loading": "Loading..."
    },
    "landing": {
        "hero": {
            "title": "Scripture Habit",
            "subtitle": "A scripture study web app personally developed by Brother Daijiro Sagane, a church member in Japan. It is completely free for anyone to use.",
            "downloadCta": "App (PWA)",
            "browserCta": "Browser",
            "demoCta": "1-Min Demo",
            "mascotBubble": "Hi there! Let's start reading the scriptures together! ✨"
        },
        "concept": {
            "title": "It's hard to keep going alone, isn't it?",
            "subtitle": "Placing yourself in a group with people who share the same goal is the best shortcut to build a habit.",
            "problemBadge": "Hard to keep going",
            "solutionBadge": "Fun to keep going!",
            "card1Title": "Studying alone...",
            "card1Text": "Busy days push it aside, and it's easy to lose momentum before you notice.",
            "card2Title": "With friends!",
            "card2Text": "When everyone gently encourages each other and turns what they noticed into words, it becomes a natural habit."
        },
        "steps": {
            "title": "How to Use",
            "step1Title": "1. Create a Group",
            "step1Desc": "Try creating a group with friends, partners, family, coworkers, or anyone else you'd like to study the scriptures with.",
            "step2Title": "2. Share what you noticed",
            "step2Desc": "Share a short note about what touched your heart or what you noticed during scripture study."
        },
        "finalCta": {
            "title": "Would you like to start a new habit with us?",
            "demoCta": "1-Min Demo",
            "mascotBubble": "Let's get started with the button below! ✨"
        },
        "downloadModal": {
            "title": "Install App",
            "iosInstruction1": "1. Tap the Share button at the bottom of the screen (or top on iPad).",
            "iosInstruction2": "2. Scroll down and tap \"Add to Home Screen\".",
            "androidInstruction": "Tap the browser menu (three dots) and select \"Install app\" or \"Add to Home screen\".",
            "desktopInstruction": "Click the install icon in the address bar or select \"Install\" from the browser menu.",
            "close": "Close"
        },
        "openSource": {
            "title": "An Open Source Initiative",
            "subtitle": "Scripture Habit is open-sourced on GitHub so that anyone can use it with complete confidence.",
            "card1Title": "Transparency & Security",
            "card1Desc": "Anyone can freely inspect how the application works and handles data.",
            "card2Title": "Built with Community",
            "card2Desc": "Anyone can contribute to development through feature proposals, bug reports via Issues, or Pull Requests on GitHub.",
            "githubBtn": "View on GitHub",
            "sponsorsComingSoon": "GitHub Sponsors (Coming Soon)"
        },
        "seoContent": {
            "faq": {
                "title": "Frequently Asked Questions",
                "q1": "How do I start a scripture study habit?",
                "a1": "It is important to edify one another. Scripture Habit supports creating the right environment for doing just that.",
                "q2": "Is Scripture Habit an official LDS app?",
                "a2": "Scripture Habit is a personal project intended to support members of The Church of Jesus Christ of Latter-day Saints and all scripture students. It is not an official app of the Church, but it is designed to work seamlessly with the Gospel Library.",
                "q3": "Can I download it from the app stores (App Store / Google Play)?",
                "a3": "This app is provided as a PWA (Progressive Web App). You can install it by opening it directly in your browser and selecting \"Add to Home Screen\" from the menu."
            }
        }
    }
};
