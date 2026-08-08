async function loadCollegeData() {
  const result = await chrome.storage.local.get(['customCollegeList']);
  if (result.customCollegeList && result.customCollegeList.length > 0) {
    return result.customCollegeList;
  }
  const response = await fetch(chrome.runtime.getURL('pdf_college_data.json'));
  const data = await response.json();
  return data;
}

function updateLog(msg, color = "#475569") {
  const logDiv = document.getElementById("statusLog");
  if (logDiv) {
    logDiv.style.display = "block";
    logDiv.style.color = color;
    logDiv.innerText = msg;
  }
}

async function sendOrInject(actionName) {
  try {
    updateLog("⏳ Loading college database...", "#2563eb");
    const collegeList = await loadCollegeData();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.id) {
      updateLog("❌ No active CET tab found!", "#dc2626");
      return;
    }

    updateLog("⏳ Connecting to webpage...", "#2563eb");

    chrome.tabs.sendMessage(tab.id, { action: actionName, preferredList: collegeList }, (response) => {
      if (chrome.runtime.lastError) {
        updateLog("🔄 Injecting helper into CET page...", "#d97706");
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"]
        }, () => {
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, { action: actionName, preferredList: collegeList });
            updateLog("✅ Task executed successfully!", "#166534");
          }, 300);
        });
      } else {
        updateLog("✅ Command sent to web page!", "#166534");
      }
    });
  } catch (err) {
    updateLog("❌ Error: " + err.message, "#dc2626");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const dropZone = document.getElementById("dropZone");
  const fileInput = document.getElementById("fileUpload");
  const loadedCount = document.getElementById("loadedCount");

  // Tab logic
  const tabMain = document.getElementById("tabMain");
  const tabGuide = document.getElementById("tabGuide");
  const contentMain = document.getElementById("contentMain");
  const contentGuide = document.getElementById("contentGuide");

  tabMain.addEventListener("click", () => {
    tabMain.classList.add("active");
    tabGuide.classList.remove("active");
    contentMain.classList.add("active");
    contentGuide.classList.remove("active");
  });

  tabGuide.addEventListener("click", () => {
    tabGuide.classList.add("active");
    tabMain.classList.remove("active");
    contentGuide.classList.add("active");
    contentMain.classList.remove("active");
  });

  document.getElementById('autoSearchBtn').addEventListener('click', () => sendOrInject("AUTO_SEARCH_MISSING"));
  document.getElementById('step2Btn').addEventListener('click', () => sendOrInject("AUTO_ORDER_STEP2"));
  document.getElementById('verifyBtn').addEventListener('click', () => sendOrInject("VERIFY_PREFERENCES"));

  // Init UI
  chrome.storage.local.get(['customCollegeList'], function(result) {
    if (result.customCollegeList && result.customCollegeList.length > 0) {
      updateUIAfterLoad(result.customCollegeList.length, "Custom List");
    } else {
      fetch(chrome.runtime.getURL('pdf_college_data.json'))
        .then(r => r.json())
        .then(data => {
          updateUIAfterLoad(data.length, "Default PDF");
        });
    }
  });

  function updateUIAfterLoad(count, sourceText) {
    loadedCount.innerHTML = `<strong>${count} choices loaded</strong> from ${sourceText}.`;
  }

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.background = '#e0f2fe'; });
  dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); dropZone.style.background = '#f1f5f9'; });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.background = '#f1f5f9';
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFile(e.target.files[0]);
  });

function handleFile(file) {
  const reader = new FileReader();
  
  if (file.name.endsWith('.json')) {
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        // BUG FIX: flush input AFTER read completes, not before
        fileInput.value = "";
        processParsedData(data);
      } catch (err) {
        fileInput.value = "";
        alert("Invalid JSON file: " + err.message);
      }
    };
    reader.readAsText(file);

  } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, {header: 1});
        
        let parsedList = [];
        let codeCol = -1, courseCol = -1;
        let dataStartRow = 0;
        
        // Scan first 5 rows for header labels
        for (let i = 0; i < Math.min(5, jsonData.length); i++) {
          let row = jsonData[i] || [];
          for (let j = 0; j < row.length; j++) {
            let val = String(row[j] || "").toLowerCase();
            if (val.includes("course") || val.includes("branch")) { courseCol = j; }
            if ((val.includes("institute") && val.includes("code")) || val === "code") { codeCol = j; }
            if (!codeCol && val.includes("code") && !val.includes("course")) { codeCol = j; }
          }
          if (codeCol !== -1 && courseCol !== -1) {
            dataStartRow = i + 1;
            break;
          }
        }
        
        // Fallback: scan rows for first 4-digit number to identify code column
        if (codeCol === -1 || courseCol === -1) {
          for (let i = 0; i < Math.min(10, jsonData.length); i++) {
            let row = jsonData[i] || [];
            for (let j = 0; j < row.length; j++) {
              if (String(row[j] || "").match(/^\d{4,5}$/)) {
                codeCol = j;
                courseCol = j + 1;
                dataStartRow = i;
                break;
              }
            }
            if (codeCol !== -1) break;
          }
          if (codeCol === -1) { codeCol = 1; courseCol = 2; dataStartRow = 1; }
        }

        for (let i = dataStartRow; i < jsonData.length; i++) {
          let row = jsonData[i];
          if (!row || row.length === 0) continue;
          let code = row[codeCol] ? String(row[codeCol]).trim() : "";
          let course = row[courseCol] ? String(row[courseCol]).trim() : "";
          
          if (code && code.match(/^\d{4,5}$/) && course && course.length > 3) {
             parsedList.push({
               pdfOrder: parsedList.length + 1,
               instituteCode: code,
               coursePattern: course
             });
          }
        }
        
        fileInput.value = "";
        if (parsedList.length > 0) {
           processParsedData(parsedList);
        } else {
           alert(`Could not find valid data in this file.\n\nDetected:\n- Code column: ${codeCol}\n- Course column: ${courseCol}\n- Data start row: ${dataStartRow}\n\nEnsure your file has separate columns for Institute Code (4-digit) and Course/Branch Name.`);
        }
        
      } catch(err) {
        fileInput.value = "";
        alert("Error reading Excel/CSV file: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);

  } else if (file.name.endsWith('.pdf')) {
    reader.onload = async (e) => {
      // Flush input at start of async handler
      fileInput.value = "";
      try {
        const typedarray = new Uint8Array(e.target.result);
        if (typeof pdfjsLib === 'undefined') {
          alert("PDF parser not loaded. Make sure pdf.min.js is included.");
          return;
        }
        pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');
        
        updateLog("⏳ Parsing PDF file...", "#d97706");
        const pdf = await pdfjsLib.getDocument({data: typedarray}).promise;
        
        let parsedList = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          // BUG FIX: was scanning globally and going BACKWARDS for course name.
          // Branch name comes AFTER the code in the PDF table (left to right).
          // Fix: group text items by Y-row, then extract code + course left-to-right per row.
          const rowMap = {};
          for (const item of textContent.items) {
            if (!item.str.trim()) continue;
            const yKey = Math.round(item.transform[5] / 5) * 5;
            if (!rowMap[yKey]) rowMap[yKey] = [];
            rowMap[yKey].push({ x: item.transform[4], text: item.str.trim() });
          }
          
          // Sort rows top to bottom
          const sortedYKeys = Object.keys(rowMap).map(Number).sort((a, b) => b - a);
          
          for (const yKey of sortedYKeys) {
            const rowItems = rowMap[yKey].sort((a, b) => a.x - b.x).map(i => i.text);
            
            for (let i = 0; i < rowItems.length; i++) {
              if (rowItems[i].match(/^\d{4,5}$/) && rowItems[i] !== "2026" && rowItems[i] !== "2027") {
                const code = rowItems[i];
                
                // Collect text AFTER the code in the same row (branch is to the right)
                let courseParts = [];
                for (let j = i + 1; j < rowItems.length; j++) {
                  const part = rowItems[j];
                  if (part.match(/^\d{4,5}$/)) break;
                  if (["un-aided", "aided", "government", "autonomous", "pune", "mumbai", "nagpur",
                       "nashik", "amravati", "akola", "jalgaon", "navi mumbai", "aurangabad"].some(kw => part.toLowerCase() === kw)) break;
                  if (part.match(/^\d{1,3}$/) && j === i + 1) break;
                  courseParts.push(part);
                }
                
                const course = courseParts.join(" ").trim();
                if (course.length > 4) {
                  parsedList.push({
                    pdfOrder: parsedList.length + 1,
                    instituteCode: code,
                    coursePattern: course
                  });
                  break;
                }
              }
            }
          }
        }
        
        if (parsedList.length > 0) {
           updateLog(`✅ Extracted ${parsedList.length} entries from PDF!`, "#166534");
           processParsedData(parsedList);
        } else {
           alert("Could not extract data from this PDF.\n\nTips:\n- Make sure text is selectable (not a scanned image)\n- For best accuracy, use Excel/CSV instead");
        }
      } catch(err) {
        alert("Error reading PDF: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);

  } else {
    alert("Please upload a .json, .csv, .xlsx, or .pdf file.");
  }
  // NOTE: Do NOT reset fileInput here — it cancels async reads on some browsers.
}

function processParsedData(data) {
  if (!Array.isArray(data) || data.length === 0) {
    alert("No valid data found in file. Please check the format.");
    return;
  }

  // Normalize all entries
  const normalized = data.map((item, idx) => ({
    pdfOrder: item.pdfOrder || (idx + 1),
    instituteCode: String(item.instituteCode || item.code || "").trim(),
    coursePattern: String(item.coursePattern || item.branch || item.course || "").trim()
  })).filter(item => item.instituteCode && item.coursePattern);

  if (normalized.length === 0) {
    alert("Parsed data has no valid entries with both Institute Code and Course Name.");
    return;
  }

  // BUG FIX: First CLEAR old stale data, THEN set new list to avoid conflicts
  chrome.storage.local.remove(['customCollegeList'], () => {
    chrome.storage.local.set({ customCollegeList: normalized }, () => {
      const loadedCountEl = document.getElementById("loadedCount");
      if (loadedCountEl) {
        loadedCountEl.innerHTML = `<strong>${normalized.length} choices loaded</strong> from Custom List.`;
      }
      updateLog(`✅ ${normalized.length} colleges loaded!`, "#166534");
      alert(`Successfully loaded ${normalized.length} preferences!\n\nTop 3 entries:\n${normalized.slice(0, 3).map((e, i) => `${i+1}. Code ${e.instituteCode} - ${e.coursePattern}`).join('\n')}`);
      
      // BUG FIX: Pass already-loaded data directly to INIT_SIDEBAR
      // instead of re-reading storage (avoids race condition)
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (!tab || !tab.id) return;
        chrome.tabs.sendMessage(tab.id, { action: "INIT_SIDEBAR", preferredList: normalized }, () => {
          if (chrome.runtime.lastError) {
            chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] }, () => {
              setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, { action: "INIT_SIDEBAR", preferredList: normalized });
              }, 400);
            });
          }
        });
      });
    });
  });
}

}); // End of DOMContentLoaded
