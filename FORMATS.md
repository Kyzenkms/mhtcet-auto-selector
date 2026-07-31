# Supported File Formats

The MHT-CET Auto-Selector extension is powered by a highly intelligent parsing engine that can extract your college preferences from almost any standard document type. 

As long as your file contains the **Institute Code** (a 4-digit number) and the **Course Name**, the extension will find it and rank the colleges based on their top-to-bottom order in the document.

Here are examples of how to format each supported file type:

---

## 1. Excel / Spreadsheets (`.xlsx`, `.xls`)

Excel is the recommended format because it's the easiest to organize. You can have as many columns as you want. The parser will scan all cells in a row and extract the 4-digit code and the branch name.

**Example Setup:**
| A (Pref No) | B (Institute Code) | C (College Name) | D (Course Name) |
| :--- | :--- | :--- | :--- |
| 1 | 1107 | P.R Pote Patil College | Computer Engineering |
| 2 | 3181 | K. J. Somaiya | Information Technology |

---

## 2. CSV (Comma Separated Values)

If you are generating your list using ChatGPT, Gemini, or a simple text editor, a `.csv` file is perfect. It follows the exact same logic as an Excel file.

**Example `preferences.csv`:**
```csv
Pref No, Institute Code, College Name, Course Name
1, 1107, P.R Pote Patil, Computer Engineering
2, 1107, P.R Pote Patil, Artificial Intelligence and Machine Learning
3, 3181, K.J. Somaiya, Computer Engineering
```

---

## 3. PDF Documents (`.pdf`)

The extension includes a built-in PDF parsing engine (`pdf.js`). It reads the text line-by-line from top to bottom. It will look for lines that contain a 4-digit number and a recognizable course name.

**Example PDF Layout:**
```text
My MHT-CET Dream List

1. 1107 - Computer Engineering
(P.R Pote Patil College of Engineering)

2. 3181 - Information Technology
(K.J. Somaiya Institute)
```
*Note: Make sure the PDF text is selectable (not a scanned image), so the extension can extract the text!*

---

## 4. JSON Files (`.json`)

For developers or students who want precise control over the data structure, you can upload a raw JSON array of objects. The parser will flatten the object values and extract the codes and courses.

**Example `preferences.json`:**
```json
[
  {
    "preference": 1,
    "code": "1107",
    "name": "P.R Pote Patil",
    "branch": "Computer Engineering"
  },
  {
    "preference": 2,
    "code": "3181",
    "branch": "Information Technology"
  }
]
```

---

## 💡 Universal Rule of Thumb
Regardless of the format you choose:
1. **Top-to-Bottom Order:** The item at the top of your document will be Preference #1. The last item will be your final preference.
2. **No Mashed Strings:** Do not mash the Institute Code and Course Name into a single word without spaces (e.g., `1107ComputerEngineering`). Keep them separate!
