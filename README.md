# MHT-CET Auto-Selector Extension

The ultimate **Guardian Angel** for MHT-CET Option Form filling! This Chrome Extension transforms the tedious, stressful process of manually selecting and ordering 200+ colleges into an automated, error-free breeze. 

It comes packed with a **Live Assistant Sidebar**, **Smart Advice branch matching**, and **1-Click Auto-Select** to ensure you don't miss a single college or accidentally select the wrong branch.

---

## 🌟 Key Features

1. **⚡ 1-Click Auto-Select (Step 1)**: Upload your custom PDF/Excel/CSV list. The extension will automatically scan the MHT-CET table and check the exact boxes for the colleges and branches on your list.
2. **📝 Auto-Order Preferences (Step 2)**: No more manually typing numbers from 1 to 200. Click the **Step 2 (Order)** button, and the extension will automatically type the preference rankings matching the exact top-to-bottom order of your uploaded file.
3. **🧠 Live Assistant Sidebar**: A persistent, floating control panel injected directly into the MHT-CET webpage.
    - **Live Counters**: Watch a real-time `Selected: 45 / 200` counter as you (or the script) select colleges.
    - **Proactive Dropdown Tracking**: Change the Course dropdown on the portal, and the sidebar will instantly tell you exactly how many colleges from your list offer that branch.
4. **💡 Smart Advice Engine**: Tricky branch names like `AI & ML` vs `Computer Science and Engineering (AI ML)`? The extension fuzzy-matches these acronyms and flashes a Yellow Smart Advice banner so you don't miss hidden branches!

---

## 🛠️ How to Install (Developer Mode)

1. Download or clone this repository to your computer.
2. Open Google Chrome and go to `chrome://extensions/`.
3. Turn on the **Developer mode** toggle in the top right corner.
4. Click **Load unpacked** in the top left corner.
5. Select the `extension/` folder from this repository.
6. The extension is now installed! Pin it to your toolbar.

---

## 📋 Phase 1: Prepare Your List

For the extension to work, your uploaded list **MUST** contain the `Institute Code` and `Course Name` in separate columns. 

**💡 Smart Parsing & Ranking:** 
- **Extra Columns:** You can absolutely include extra columns like Preference Number, College Name, etc. The parser is smart enough to extract the 4-digit code and the course name from any column!
- **Preference Ranking:** The extension automatically ranks your colleges based on their **top-to-bottom order** in the file!

### Formatting: DOs and DONTs

**✅ DO (Extra columns are fine):**
| Pref No | Institute Code | College Name | Course Name |
| :--- | :--- | :--- | :--- |
| 1 | 1107 | P.R Pote Patil | Computer Engineering |
| 2 | 1107 | P.R Pote Patil | Artificial Intelligence and Machine Learning |
| 3 | 3181 | K. J. Somaiya | Computer Engineering |

**❌ DON'T (Messy / Mashed-up Strings):**
| Institute |
| :--- |
| 1107 - P.R Pote Patil College (CE) |
| 3181 - K. J. Somaiya (Computer) |

*The extension needs the 4-digit Institute Code completely separate from the Course Name to safely execute strict matching!*

---

## 🚀 Phase 2: MHT-CET Portal Steps

### Step 1 Page (Select Options)
1. **Upload your list**: Open the extension popup, go to the **Auto-Select** tab, and upload your perfectly formatted file.
2. **Meet your Assistant**: The moment your list loads, the **Live Assistant Sidebar** will automatically slide in on the right side of the MHT-CET website!
3. **Select a Course**: Choose a branch from the website's dropdown. The Assistant will instantly calculate and tell you *exactly* how many of your colleges offer that branch.
4. **Auto-Select**: Click the purple **⚡ Auto-Select** button inside the sidebar. It will find and check all the exact matches for you.
5. **Review**: Watch the live Sidebar for 💡 **Smart Advice** warnings to catch any tricky branch names!

### Step 2 Page (Set Preferences)
1. Once you save and move to the *Set Your Preferences* page on the portal, open the Live Assistant Sidebar.
2. Click the green **Step 2 (Order)** button in the sidebar.
3. The extension will automatically type the preference numbers (1, 2, 3...) into the correct boxes exactly following the top-to-bottom order of your uploaded file!

---

## ⚠️ CRITICAL WARNING
**This extension acts as a guardian assistant, NOT a replacement for your own judgement!**
The Smart Advice engine is powerful, but MHT-CET portal layouts change occasionally. ALWAYS double-check your final preference list and read through your choices carefully before hitting final Submit.

Happy form filling, and good luck with your admissions! 🎉

---

## 🔗 Quick Links

- [📄 Supported File Formats Guide](FORMATS.md) - View detailed examples for PDF, Excel, CSV, and JSON layouts.
- [🐛 Report an Issue](https://github.com/Kyzenkms/mhtcet-auto-selector/issues) - Found a bug? Let us know!
