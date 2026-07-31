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
        processParsedData(data);
      } catch (err) {
        alert("Invalid JSON file");
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
        
        for(let i=0; i<Math.min(5, jsonData.length); i++) {
            let row = jsonData[i] || [];
            for(let j=0; j<row.length; j++) {
                let val = String(row[j]).toLowerCase();
                if (val.includes("code") || val.includes("institute")) codeCol = j;
                if (val.includes("course") || val.includes("branch")) courseCol = j;
            }
            if (codeCol !== -1 && courseCol !== -1) break;
        }
        
        // Default indices if headers not explicitly found
        if (codeCol === -1) codeCol = 1; 
        if (courseCol === -1) courseCol = 2;
        
        for (let i = 1; i < jsonData.length; i++) {
          let row = jsonData[i];
          if (!row || row.length === 0) continue;
          let code = row[codeCol] ? String(row[codeCol]).trim() : "";
          let course = row[courseCol] ? String(row[courseCol]).trim() : "";
          
          if (code && code.match(/^\d+$/) && course) {
             parsedList.push({
               pdfOrder: parsedList.length + 1,
               instituteCode: code,
               coursePattern: course
             });
          }
        }
        
        if (parsedList.length > 0) {
           processParsedData(parsedList);
        } else {
           alert("Could not find valid data. Ensure your file has columns for 'code' and 'course'.");
        }
        
      } catch(err) {
        alert("Error reading Excel/CSV file: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  } else if (file.name.endsWith('.pdf')) {
    reader.onload = async (e) => {
      try {
        const typedarray = new Uint8Array(e.target.result);
        if(typeof pdfjsLib === 'undefined') {
          alert("PDF parser not loaded. Make sure pdf.min.js is included.");
          return;
        }
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
        
        updateLog("⏳ Parsing PDF file...", "#d97706");
        const pdf = await pdfjsLib.getDocument({data: typedarray}).promise;
        
        let parsedList = [];
        let items = [];
        for (let i = 1; i <= pdf.numPages; i++) {
           const page = await pdf.getPage(i);
           const textContent = await page.getTextContent();
           items.push(...textContent.items);
        }
        
        // Sort items by Y (top to bottom), then X (left to right)
        items.sort((a, b) => {
           if (Math.abs(a.transform[5] - b.transform[5]) > 5) {
               return b.transform[5] - a.transform[5]; // higher Y comes first
           }
           return a.transform[4] - b.transform[4]; // lower X comes first
        });
        
        let sortedText = items.map(item => item.str.trim()).filter(s => s);
        
        // Detect 4/5 digit code and the text before it as the course
        for (let i = 0; i < sortedText.length; i++) {
           let val = sortedText[i];
           if (val.match(/^\d{4,5}$/)) {
               let code = val;
               let course = "";
               // Go backwards to collect the branch name
               for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
                   // stop if we hit another code or a serial number alone
                   if (sortedText[j].match(/^\d+$/)) {
                       break; // reached Sr No
                   }
                   course = sortedText[j] + " " + course;
               }
               course = course.trim();
               if (course.length > 5) {
                   parsedList.push({
                       pdfOrder: parsedList.length + 1,
                       instituteCode: code,
                       coursePattern: course
                   });
               }
           }
        }
        
        if (parsedList.length > 0) {
           processParsedData(parsedList);
        } else {
           alert("Could not accurately extract data from this PDF format. Please use Excel/CSV for 100% accuracy.");
        }
      } catch(err) {
        alert("Error reading PDF: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    alert("Please upload a .json, .csv, .xlsx, or .pdf file.");
  }
  // reset input
  fileInput.value = "";
}

function processParsedData(data) {
  if (!Array.isArray(data)) {
    alert("Data should be an array of preferences.");
    return;
  }
  // Standardize the fields if needed, but we trust our parsing
  chrome.storage.local.set({ customCollegeList: data }, () => {
    const loadedCount = document.getElementById("loadedCount");
    loadedCount.innerHTML = `<strong>${data.length} choices loaded</strong> from Custom List.`;
    alert(`Successfully loaded ${data.length} college choices from file!`);
    sendOrInject("INIT_SIDEBAR");
  });
}

}); // End of DOMContentLoaded
