// Helper to normalize branch names for STRICT exact branch matching (handles portal formatting quirks)
function normalizeBranchName(text) {
  if (!text) return "";
  let norm = text.toLowerCase().trim();
  
  norm = norm.replace(/&/g, "and");
  
  // Strip out parenthetical variations
  norm = norm.replace(/\(ai\)/g, "ai");
  norm = norm.replace(/\(ai and ml\)/g, "aiml");
  norm = norm.replace(/\(ai and data science\)/g, "aids");
  norm = norm.replace(/\(data science\)/g, "data science");
  
  // Standardize common branch acronyms so PDF and Web portal match 100%
  norm = norm.replace(/artificial intelligence and machine learning/g, "aiml");
  norm = norm.replace(/artificial intelligence ai and machine learning/g, "aiml");
  norm = norm.replace(/artificial intelligence and data science/g, "aids");
  norm = norm.replace(/artificial intelligence ai and data science/g, "aids");
  norm = norm.replace(/ai and ml/g, "aiml");
  norm = norm.replace(/ai and data science/g, "aids");
  
  norm = norm.replace(/computer science and engineering/g, "cse");
  norm = norm.replace(/computer science engineering/g, "cse");
  
  norm = norm.replace(/[^a-z0-9 ]/g, " ");
  norm = norm.replace(/\s+/g, " ");
  return norm.trim();
}

// Normalize an institute code (strip leading zeros)
function normCode(code) {
  return String(code).trim().replace(/^0+/, '');
}

// Check if a row's text matches a target course pattern STRICTLY (no merging of branches)
function matchesCoursePattern(rowText, targetPattern, instituteCode = "") {
  const normRow = normalizeBranchName(rowText);
  const normTarget = normalizeBranchName(targetPattern);
  
  if (!normRow || !normTarget) return false;
  if (normRow === normTarget) return true;
  if (normRow.includes(normTarget) || normTarget.includes(normRow)) return true;
  return false;
}

// Check if a row loosely matches (used for Smart Advice when exact match fails)
function fuzzyMatchCourse(rowText, targetPattern) {
  const normRow = normalizeBranchName(rowText);
  const normTarget = normalizeBranchName(targetPattern);
  if (!normRow || !normTarget) return false;
  
  const getKeywords = (str) => {
    let kw = str.replace(/[()]/g, ' ').split(' ').filter(w => w.length > 2 && w !== "and" && w !== "the" && w !== "engineering" && w !== "technology");
    if (str.includes("aiml") || (str.includes("ai") && str.includes("ml"))) kw.push("aiml");
    if (str.includes("artificial intelligence") || str.includes("ai")) kw.push("ai");
    if (str.includes("computer science") || str.includes("cse")) kw.push("cse");
    if (str.includes("information technology") || str.includes("it")) kw.push("it");
    return [...new Set(kw)];
  };

  const rowKW = getKeywords(normRow);
  const targetKW = getKeywords(normTarget);

  let matchCount = 0;
  for (const kw of targetKW) {
    if (rowKW.includes(kw)) matchCount++;
  }
  
  return matchCount > 0 && (rowKW.includes("ai") || rowKW.includes("cse") || rowKW.includes("it") || rowKW.includes("data"));
}

// Helper to sleep/delay to simulate human interaction
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function autoSelectStep1(preferredList) {
  console.log("MHT-CET Auto-Selector: Step 1 Shortlisting...");
  const tableRows = Array.from(document.querySelectorAll("table tbody tr"));
  
  // Guard check: ensure we are on a page with checkboxes (Step 1)
  const hasCheckboxes = tableRows.some(row => row.querySelector("input[type='checkbox']"));
  if (!hasCheckboxes) {
    alert("⚠️ Could not find any checkboxes on this page!\n\nPlease make sure you are on the 'Shortlist Your Options' (Step 1) page and have clicked 'Search Institute' before running this.");
    return;
  }

  let checkedCount = 0;

  for (const row of tableRows) {
    const text = row.innerText;
    const checkbox = row.querySelector("input[type='checkbox']");
    if (!checkbox) continue;

    let shouldSelect = false;

    for (const item of preferredList) {
      const code = item.instituteCode;
      if (text.includes(code) || text.includes(code.padStart(5, '0'))) {
        if (matchesCoursePattern(text, item.coursePattern, code)) {
          shouldSelect = true;
          break;
        }
      }
    }

    if (shouldSelect && !checkbox.checked) {
      checkbox.click();
      checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      checkedCount++;
      await sleep(50 + Math.random() * 70);
    }
  }

  alert(`MHT-CET Auto-Selector:\nChecked ${checkedCount} NEW matching branches from your PDF list!`);
  updateSidebarCounter();
}

async function autoOrderStep2(preferredList) {
  console.log("MHT-CET Auto-Selector: Step 2 Preference Ordering...");
  const rows = Array.from(document.querySelectorAll("table tbody tr"));

  // Guard check: ensure we are on a page with number/text inputs or checkboxes (Step 2)
  const hasInputs = rows.some(row => row.querySelector("input[type='checkbox'], input[type='text'], input[type='number']"));
  if (!hasInputs) {
    alert("⚠️ Could not find preference options on this page!\n\nPlease make sure you are on the 'Set Your Preferences' (Step 2) page before running this.");
    return;
  }

  // 1. Inspect existing manual selections on the page
  let maxExistingRank = 0;
  let rowItems = rows.map(row => {
    const text = row.innerText;
    const checkbox = row.querySelector("input[type='checkbox']");
    const numInput = row.querySelector("input[type='text'], input[type='number']");
    
    const isChecked = checkbox ? checkbox.checked : false;
    let rank = 0;
    
    if (numInput && numInput.value) {
      rank = parseInt(numInput.value) || 0;
    } else if (isChecked) {
      const cells = Array.from(row.querySelectorAll("td"));
      const lastCell = cells[cells.length - 1];
      if (lastCell && lastCell.innerText.trim().match(/^\d+$/)) {
        rank = parseInt(lastCell.innerText.trim()) || 0;
      }
    }

    if (rank > maxExistingRank) maxExistingRank = rank;

    return { row, text, checkbox, numInput, isChecked, rank, alreadyRanked: isChecked };
  });

  const orderedTargets = preferredList.map(item => ({
    code: normCode(item.instituteCode),
    pattern: item.coursePattern,
  }));

  let assignedRank = maxExistingRank + 1;
  let newMatchesCount = 0;

  for (const target of orderedTargets) {
    // Find matching row for this target
    const match = rowItems.find(item => {
      const codeMatch = item.text.includes(target.code) || item.text.includes(target.code.replace(/^0+/, ""));
      return codeMatch && matchesCoursePattern(item.text, target.pattern, target.code);
    });

    if (match) {
      // If this row is ALREADY checked by the user, preserve its manual rank!
      if (match.alreadyRanked || match.isChecked) {
        console.log(`Skipping already checked row: ${target.code} (${target.pattern}) with manual rank ${match.rank}`);
        continue;
      }

      match.alreadyRanked = true;
      newMatchesCount++;
      
      // Native click to ensure checkbox toggles AND portal assigns the next preference number
      if (match.checkbox) {
        match.checkbox.click();
        match.checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      } else if (match.numInput) {
        match.numInput.value = assignedRank;
        match.numInput.dispatchEvent(new Event('input', { bubbles: true }));
        match.numInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      assignedRank++;
      await sleep(70 + Math.random() * 80);
    }
  }

  if (maxExistingRank > 0) {
    alert(`MHT-CET Auto-Selector:\n\n- Detected ${maxExistingRank} existing manual preference(s).\n- Added ${newMatchesCount} NEW preferences in order starting from rank #${maxExistingRank + 1}!`);
  } else {
    alert(`MHT-CET Auto-Selector:\n\nSuccessfully set preference order for ${newMatchesCount} colleges!`);
  }
}

function verifyPreferences(preferredList) {
  console.log("MHT-CET Auto-Selector: Verifying current preferences against PDF database...");

  const rows = Array.from(document.querySelectorAll("table tbody tr"));

  let targetList = preferredList.map(item => ({
    pdfOrder: item.pdfOrder,
    instituteCode: item.instituteCode,
    coursePattern: item.coursePattern
  }));

  let pageItems = [];
  rows.forEach((row, index) => {
    const text = row.innerText.trim();
    if (!text || text.length < 5) return;

    const cells = Array.from(row.querySelectorAll("td"));
    let code = "N/A";
    if (cells[1]) {
      const cMatch = cells[1].innerText.trim().match(/\d{4,5}/);
      if (cMatch) code = cMatch[0];
    }
    if (code === "N/A") {
      const cMatch = text.match(/\b\d{4,5}\b/);
      if (cMatch) code = cMatch[0];
    }

    const numInput = row.querySelector("input[type='text'], input[type='number']");
    const checkbox = row.querySelector("input[type='checkbox']");
    const isChecked = checkbox ? checkbox.checked : false;
    const prefRank = numInput ? numInput.value : (isChecked ? "Selected" : "Not Selected");

    pageItems.push({
      index: index + 1,
      code: normCode(code),
      fullText: text,
      prefRank,
      isChecked,
      rowEl: row,
      checkboxEl: checkbox,
      matched: false
    });
  });

  let matched = [];
  let missing = [];

  targetList.forEach(target => {
    const match = pageItems.find(item => {
      const codeMatch = item.code === normCode(target.instituteCode) || 
                        item.fullText.includes(target.instituteCode) ||
                        item.fullText.includes(normCode(target.instituteCode));
      return codeMatch && matchesCoursePattern(item.fullText, target.coursePattern, target.instituteCode);
    });

    if (match) {
      match.matched = true;
      matched.push({ target, matchedPageItem: match });
    } else {
      missing.push(target);
      
      // Smart Advice: Check for a near match for this missing target
      const nearMatch = pageItems.find(item => {
        return (item.code === normCode(target.instituteCode) || item.fullText.includes(target.instituteCode)) 
               && fuzzyMatchCourse(item.fullText, target.coursePattern);
      });
      
      if (nearMatch && nearMatch.rowEl) {
        if (!nearMatch.rowEl.previousElementSibling || !nearMatch.rowEl.previousElementSibling.classList.contains("smart-advice-row")) {
          const colSpan = nearMatch.rowEl.children.length;
          const adviceHtml = `
            <tr class="smart-advice-row" style="background: #eff6ff;">
              <td colspan="${colSpan}" style="padding: 10px; border-left: 4px solid #3b82f6;">
                <div style="color: #1e3a8a; font-size: 13px; display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 16px;">💡</span>
                  <div>
                    <strong>Smart Advice:</strong> You requested <strong>${target.instituteCode} - ${target.coursePattern}</strong>, 
                    but we found a slightly different branch name here. 
                    If you want this branch, select it manually or adjust your filter.
                  </div>
                </div>
              </td>
            </tr>
          `;
          nearMatch.rowEl.insertAdjacentHTML("beforebegin", adviceHtml);
        }
      }
    }
  });

  // Filter extra options (excluding matched PDF items)
  const extra = pageItems.filter(item => !item.matched && item.code !== "N/A");

  alert(`MHT-CET Verification Summary:\n\n✅ Matched: ${matched.length}\n⚠️ Missing from Page: ${missing.length}\n⚡ Extra on Page: ${extra.length}\n\nClick OK to open detailed report view.`);

  let existingModal = document.getElementById("cet-verifier-modal");
  if (existingModal) existingModal.remove();

  const modalHtml = `
    <div id="cet-verifier-modal" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.85); z-index: 2147483647; display: flex; align-items: center; justify-content: center; font-family: sans-serif;">
      <div style="background: #ffffff; width: 90%; max-width: 850px; max-height: 85vh; border-radius: 12px; padding: 24px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); display: flex; flex-direction: column; overflow: hidden; position: relative;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px;">
          <h2 style="margin: 0; color: #1e293b; font-size: 18px;">📊 PDF vs Web Page Verification</h2>
          <button id="close-modal-btn" style="background: #ef4444; color: white; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">✕ Close</button>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin: 16px 0;">
          <div style="background: #dcfce7; color: #166534; padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold;">${matched.length}</div>
            <div style="font-size: 12px;">Matching Options</div>
          </div>
          <div style="background: #fee2e2; color: #991b1b; padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold;">${missing.length}</div>
            <div style="font-size: 12px;">Missing from Web Page</div>
          </div>
          <div style="background: #fef3c7; color: #92400e; padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold;">${extra.length}</div>
            <div style="font-size: 12px;">Extra on Web Page</div>
          </div>
        </div>
        <div style="flex: 1; overflow-y: auto; padding-right: 8px;">
          <h3 style="color: #991b1b; font-size: 14px; margin-top: 10px;">⚠️ Missing from Page (${missing.length})</h3>
          ${missing.length === 0 ? '<p style="font-size:12px; color: #166534;">All PDF colleges are present!</p>' : `
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px;">
              <thead><tr style="background: #f8fafc; text-align: left;"><th style="padding: 6px;">PDF #</th><th style="padding: 6px;">Code</th><th style="padding: 6px;">Course Pattern</th></tr></thead>
              <tbody>
                ${missing.map(m => `<tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding:6px;">${m.pdfOrder || 'N/A'}</td><td style="padding:6px; font-weight:bold;">${m.instituteCode}</td><td style="padding:6px;">${m.coursePattern}</td></tr>`).join('')}
              </tbody>
            </table>
          `}
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px;">
            <h3 style="color: #92400e; font-size: 14px; margin: 0;">⚡ Extra / Unmatched on Page (${extra.length})</h3>
            ${extra.length > 0 ? `<button id="clear-extra-btn" style="background: #dc2626; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: bold;">🧹 Uncheck &amp; Highlight Extra (${extra.length})</button>` : ''}
          </div>
          ${extra.length === 0 ? '<p style="font-size:12px; color: #166534;">No extra choices selected!</p>' : `
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px;">
              <thead><tr style="background: #f8fafc; text-align: left;"><th style="padding: 6px;">Code</th><th style="padding: 6px;">Status / Preference Rank</th><th style="padding: 6px;">Snippet</th></tr></thead>
              <tbody>
                ${extra.map(e => `<tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding:6px; font-weight:bold;">${e.code}</td><td style="padding:6px;">${e.prefRank}</td><td style="padding:6px; color:#64748b;">${e.fullText.substring(0, 60)}...</td></tr>`).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  document.getElementById("close-modal-btn").onclick = function() {
    document.getElementById("cet-verifier-modal").remove();
  };

  const clearBtn = document.getElementById("clear-extra-btn");
  if (clearBtn) {
    clearBtn.onclick = async function() {
      let uncheckCount = 0;
      for (const item of extra) {
        if (item.rowEl) {
          item.rowEl.style.backgroundColor = "#fee2e2";
        }
        if (item.checkboxEl && item.checkboxEl.checked) {
          item.checkboxEl.click();
          uncheckCount++;
          await sleep(40);
        }
      }
      alert(`🧹 Action Completed!\n\n- Unchecked ${uncheckCount} extra option checkboxes.\n- Highlighted all ${extra.length} extra rows in RED on the page so you can easily review or remove them.`);
      document.getElementById("cet-verifier-modal").remove();
    };
  }
}

// Feature: Auto-Select ONLY in Top Search Results Table
async function autoSearchAndAddMissing(preferredList) {
  console.log("MHT-CET Auto-Selector: Auto-selecting matches in top search table...");

  const allSelects = Array.from(document.querySelectorAll("select"));
  
  let courseSelect = allSelects.find(s => (s.id + " " + s.name).toLowerCase().includes("course"));
  
  if (!courseSelect) {
    courseSelect = allSelects.find(s => 
      Array.from(s.options).some(o => o.text.toLowerCase().includes("engineering") || o.text.toLowerCase().includes("technology"))
    );
  }

  if (!courseSelect) {
    courseSelect = allSelects.find(s => s.selectedIndex > 0);
  }

  const selectedCourse = courseSelect && courseSelect.selectedIndex > 0
    ? courseSelect.options[courseSelect.selectedIndex].text.trim()
    : "";

  if (!selectedCourse) {
    alert("⚠️ Could not detect selected course!\n\nPlease:\n1. Select a Course from the dropdown on the page\n2. Click 'Search Institute'\n3. Then click this button again.");
    return;
  }

  const normSelected = normalizeBranchName(selectedCourse);

  const relevantItems = preferredList.filter(item => {
    const normItem = normalizeBranchName(item.coursePattern);
    return normItem === normSelected || normItem.includes(normSelected) || normSelected.includes(normItem);
  });

  const pdfCodeSet = new Set(relevantItems.map(item => normCode(item.instituteCode)));

  const allTables = Array.from(document.querySelectorAll("table"));
  
  const headingEl = Array.from(document.querySelectorAll("*")).find(el =>
    el.children.length === 0 && el.innerText && el.innerText.includes("Select Options of Your Choice")
  );

  let topSearchTable = null;
  for (const tbl of allTables) {
    const hasCheckboxes = tbl.querySelector("tbody input[type='checkbox']");
    if (!hasCheckboxes) continue;
    if (headingEl) {
      const position = headingEl.compareDocumentPosition(tbl);
      if (position & Node.DOCUMENT_POSITION_PRECEDING) {
        topSearchTable = tbl;
        break;
      }
    } else {
      topSearchTable = tbl;
      break;
    }
  }

  if (!topSearchTable) topSearchTable = allTables.find(t => t.querySelector("tbody input[type='checkbox']")) || allTables[0];

  const checkboxes = topSearchTable ? Array.from(topSearchTable.querySelectorAll("tbody input[type='checkbox']")) : [];
  
  if (checkboxes.length === 0) {
    alert("No search results found! Please click 'Search Institute' first.");
    return;
  }

  const headerRow = topSearchTable.querySelector("thead tr") || topSearchTable.querySelector("tbody tr:first-child");
  let codeColIndex = 1;
  if (headerRow) {
    const hdrs = Array.from(headerRow.querySelectorAll("th, td"));
    const idx = hdrs.findIndex(h => {
      const t = h.innerText.toLowerCase();
      return t.includes("institute code") || t.includes("code");
    });
    if (idx >= 0) codeColIndex = idx;
  }

  // Count matching visible colleges on screen
  let visibleMatchesCount = 0;
  checkboxes.forEach(cb => {
    const row = cb.closest("tr");
    if (!row) return;
    const cells = Array.from(row.querySelectorAll("td"));
    const rawCode = cells[codeColIndex] ? cells[codeColIndex].innerText.trim() : "";
    if (rawCode && pdfCodeSet.has(normCode(rawCode))) {
      visibleMatchesCount++;
    }
  });

  const proceedMsg = `🔍 Extension detected:\n\nCourse Filter: "${selectedCourse}"\nMatching entries in your PDF list: ${relevantItems.length}\nColleges currently visible in this search table: ${visibleMatchesCount}\n\nProceed to select these ${visibleMatchesCount} visible colleges on your screen?`;
  if (!window.confirm(proceedMsg)) return;

  if (relevantItems.length === 0) {
    alert(`No exact entries found in your uploaded list for:\n"${selectedCourse}"\n\n💡 Smart Advice: If you know a college has this branch, check if your uploaded list uses a different name (e.g. "CSE (AI ML)" vs "AI ML").`);
    return;
  }

  let checkedCount = 0;
  let skippedAlready = 0;
  
  const fullPdfCodeSet = new Set(preferredList.map(item => normCode(item.instituteCode)));

  for (const cb of checkboxes) {
    const row = cb.closest("tr");
    if (!row) continue;
    if (cb.checked) { skippedAlready++; continue; }

    const cells = Array.from(row.querySelectorAll("td"));
    const rawCode = cells[codeColIndex] ? cells[codeColIndex].innerText.trim() : "";
    const rowCode = normCode(rawCode);

    if (!rowCode) continue;

    const isMatch = pdfCodeSet.has(rowCode);

    if (isMatch) {
      if (cb.click) {
        cb.click();
      } else {
        cb.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
      row.style.backgroundColor = "#dcfce7";
      checkedCount++;
      await sleep(50 + Math.random() * 60);
    } else if (fullPdfCodeSet.has(rowCode)) {
      if (row.style.display === "none") continue;

      const targetItems = preferredList.filter(item => normCode(item.instituteCode) === rowCode);
      let isNearMatch = false;
      let targetPattern = "";
      
      const rowText = row.innerText;
      for (const t of targetItems) {
        if (fuzzyMatchCourse(rowText, t.coursePattern)) {
           isNearMatch = true;
           targetPattern = t.coursePattern;
           break;
        }
      }
      
      if (isNearMatch) {
        if (!row.previousElementSibling || !row.previousElementSibling.classList.contains("smart-advice-row")) {
          const colSpan = row.children.length;
          const adviceHtml = `
            <tr class="smart-advice-row" style="background: #eff6ff;">
              <td colspan="${colSpan}" style="padding: 10px; border-left: 4px solid #3b82f6;">
                <div style="color: #1e3a8a; font-size: 13px; display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 16px;">💡</span>
                  <div>
                    <strong>Smart Advice:</strong> Your uploaded list requests <strong>${targetPattern}</strong> for ${rowCode}. 
                    This row has a slightly different branch name. Check the box manually if you meant this branch.
                  </div>
                </div>
              </td>
            </tr>
          `;
          row.insertAdjacentHTML("beforebegin", adviceHtml);
        }
      }
    }
  }

  if (checkedCount > 0) {
    alert(`✅ Selected ${checkedCount} matching colleges for "${selectedCourse}"!\n(${skippedAlready} were already checked)\n\nNow click 'ADD Selected Options' on the page.`);
  } else {
    alert(`No new matches found for "${selectedCourse}".\n(${skippedAlready} already checked, ${relevantItems.length} in uploaded list)\n\nTry a different course or verify institute codes.`);
  }
}

// Inject Live Sidebar UI
function injectSidebar() {
  if (document.getElementById("mhtcet-live-sidebar")) return;

  const totalColleges = window.currentPreferredList ? window.currentPreferredList.length : 0;

  const sidebarHTML = `
    <div id="mhtcet-live-sidebar" style="position: fixed; right: 0; top: 15%; width: 320px; background: white; box-shadow: -2px 0 10px rgba(0,0,0,0.1); border-left: 3px solid #2563eb; border-radius: 8px 0 0 8px; z-index: 999999; font-family: 'Segoe UI', Tahoma, sans-serif; transition: transform 0.3s; transform: translateX(0);">
      <div id="mhtcet-sidebar-toggle" style="position: absolute; left: -30px; top: 10px; width: 30px; height: 30px; background: #2563eb; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 4px 0 0 4px; font-weight: bold; font-size: 16px;">
        ❯
      </div>
      <div style="padding: 15px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 10px;">
          <h3 style="margin: 0; color: #1e3a8a; font-size: 16px;">Live Assistant</h3>
          <span id="mhtcet-sidebar-counter" style="background: #e2e8f0; color: #1e293b; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">Selected: 0 / ${totalColleges}</span>
        </div>
        
        <div style="display: flex; gap: 8px; margin-bottom: 10px;">
          <button id="mhtcet-sidebar-auto" style="flex: 1; padding: 6px; background: #7c3aed; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;">⚡ Auto-Select</button>
          <button id="mhtcet-sidebar-step2" style="flex: 1; padding: 6px; background: #0d9488; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;">Step 2 (Order)</button>
          <button id="mhtcet-sidebar-verify" style="flex: 1; padding: 6px; background: white; color: #3b82f6; border: 1px solid #3b82f6; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;">🔍 Verify</button>
        </div>

        <div id="mhtcet-sidebar-logs" style="max-height: 350px; overflow-y: auto; font-size: 12px; display: flex; flex-direction: column; gap: 8px;">
          <div style="padding: 8px; background: #f8fafc; border-radius: 4px; color: #475569; font-style: italic;">
            Ready and watching your selections...
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', sidebarHTML);

  let isCollapsed = false;
  document.getElementById("mhtcet-sidebar-toggle").addEventListener("click", (e) => {
    isCollapsed = !isCollapsed;
    document.getElementById("mhtcet-live-sidebar").style.transform = isCollapsed ? "translateX(100%)" : "translateX(0)";
    e.target.innerText = isCollapsed ? "❮" : "❯";
  });

  // Attach button listeners
  document.getElementById("mhtcet-sidebar-auto").addEventListener("click", () => {
    if (window.currentPreferredList) autoSearchAndAddMissing(window.currentPreferredList);
    else alert("⚠️ No college list loaded! Please upload your list from the extension popup first.");
  });
  document.getElementById("mhtcet-sidebar-step2").addEventListener("click", () => {
    if (window.currentPreferredList) autoOrderStep2(window.currentPreferredList);
    else alert("⚠️ No college list loaded! Please upload your list from the extension popup first.");
  });
  document.getElementById("mhtcet-sidebar-verify").addEventListener("click", () => {
    if (window.currentPreferredList) verifyPreferences(window.currentPreferredList);
    else alert("⚠️ No college list loaded! Please upload your list from the extension popup first.");
  });
}

function getCourseNameForRow(row) {
  if (row) {
    const table = row.closest("table");
    if (table) {
      const headerRow = table.querySelector("thead tr") || table.querySelector("tbody tr:first-child");
      if (headerRow) {
        const hdrs = Array.from(headerRow.querySelectorAll("th, td"));
        const courseColIdx = hdrs.findIndex(h => {
          const t = h.innerText.toLowerCase();
          return t.includes("course") || t.includes("branch");
        });
        if (courseColIdx >= 0) {
          const cells = Array.from(row.querySelectorAll("td"));
          if (cells[courseColIdx]) {
            return cells[courseColIdx].innerText.trim();
          }
        }
      }
    }
  }

  // Fallback for Step 1 Search Table: get selected course from the page's dropdown filter
  const allSelects = Array.from(document.querySelectorAll("select"));
  let courseSelect = allSelects.find(s => (s.id + " " + s.name).toLowerCase().includes("course"));
  if (!courseSelect) {
    courseSelect = allSelects.find(s => 
      Array.from(s.options).some(o => o.text.toLowerCase().includes("engineering") || o.text.toLowerCase().includes("technology"))
    );
  }
  if (!courseSelect) {
    courseSelect = allSelects.find(s => s.selectedIndex > 0);
  }
  
  if (courseSelect && courseSelect.selectedIndex > 0) {
    return courseSelect.options[courseSelect.selectedIndex].text.trim();
  }

  return "";
}

function updateSidebarCounter() {
  const counterEl = document.getElementById("mhtcet-sidebar-counter");
  if (!counterEl || !window.currentPreferredList) return;
  
  const checkedBoxes = document.querySelectorAll("table tbody input[type='checkbox']:checked");
  const total = window.currentPreferredList.length;
  
  const checkedCodes = new Set();
  checkedBoxes.forEach(cb => {
    const row = cb.closest("tr");
    if (!row) return;
    const cells = Array.from(row.querySelectorAll("td"));
    if (cells[1]) {
      const code = normCode(cells[1].innerText.trim());
      if (code && code.match(/^\d+$/)) checkedCodes.add(code);
    }
  });

  counterEl.innerText = `Colleges: ${checkedCodes.size} / ${total} (${checkedBoxes.length} options)`;
}

function addSidebarLog(message, type = "info") {
  const logContainer = document.getElementById("mhtcet-sidebar-logs");
  if (!logContainer) return;
  
  const colors = {
    info: { bg: "#eff6ff", border: "#3b82f6", color: "#1d4ed8" },
    success: { bg: "#f0fdf4", border: "#22c55e", color: "#166534" },
    warning: { bg: "#fef2f2", border: "#ef4444", color: "#b91c1c" }
  };
  const theme = colors[type] || colors.info;
  
  const logDiv = document.createElement("div");
  logDiv.style.cssText = `padding: 8px; background: ${theme.bg}; border-left: 3px solid ${theme.border}; border-radius: 4px; color: ${theme.color};`;
  logDiv.innerHTML = message;
  
  logContainer.prepend(logDiv);
}

// Track manual checkbox clicks
function setupLiveTracking(preferredList) {
  if (window.hasLiveTracking) {
    window.currentPreferredList = preferredList;
    updateSidebarCounter();
    return;
  }
  
  window.hasLiveTracking = true;
  window.currentPreferredList = preferredList;

  document.addEventListener("change", (e) => {
    // 1. Handle Checkbox selections
    if (e.target.tagName.toLowerCase() === "input" && e.target.type === "checkbox") {
      const isChecked = e.target.checked;
      const row = e.target.closest("tr");
      if (!row) return;

      const cells = Array.from(row.querySelectorAll("td"));
      if (cells.length < 2) return;

      let codeColIndex = 1;
      const tableEl = row.closest("table");
      if (tableEl) {
        const headerRow = tableEl.querySelector("thead tr");
        if (headerRow) {
          const hdrs = Array.from(headerRow.querySelectorAll("th, td"));
          const idx = hdrs.findIndex(h => {
            const t = h.innerText.toLowerCase();
            return t.includes("institute code") || t.includes("code");
          });
          if (idx >= 0) codeColIndex = idx;
        }
      }

      if (!cells[codeColIndex]) return;
      const rawCode = cells[codeColIndex].innerText.trim();
      const code = normCode(rawCode);
      const collegeName = cells[codeColIndex + 1] ? cells[codeColIndex + 1].innerText.trim() : "";
      const courseName = getCourseNameForRow(row);

      if (isChecked) {
        const match = window.currentPreferredList.find(item => normCode(item.instituteCode) === code && matchesCoursePattern(courseName, item.coursePattern, code));
        
        if (match) {
          addSidebarLog(`<strong>✅ Safe:</strong> Selected ${rawCode} (${collegeName}).`, "success");
        } else {
          const isCodeInList = window.currentPreferredList.find(item => normCode(item.instituteCode) === code);
          if (isCodeInList) {
            const fuzzyMatch = fuzzyMatchCourse(courseName, isCodeInList.coursePattern);
            if (fuzzyMatch) {
               addSidebarLog(`<strong>💡 Smart Advice:</strong> Selected ${rawCode} (${collegeName}). Your list asked for "${isCodeInList.coursePattern}".`, "warning");
            } else {
               addSidebarLog(`<strong>⚠️ Warning:</strong> Selected ${rawCode} (${collegeName}), but your PDF list asked for <em>${isCodeInList.coursePattern}</em> instead of <em>${courseName}</em>!`, "warning");
            }
          } else {
            addSidebarLog(`<strong>⚠️ Warning:</strong> Selected ${rawCode} (${collegeName}), but this institute is NOT on your uploaded list at all!`, "warning");
          }
        }
      } else {
        addSidebarLog(`<em>Unselected ${rawCode} (${collegeName}).</em>`, "info");
      }
      
      updateSidebarCounter();
    }
    
    // 2. Handle Dropdown selections (Proactive Assistant)
    // BUG FIX: was only watching id="courseSelect" but the real portal uses different IDs
    if (e.target.tagName.toLowerCase() === "select") {
        const opts = Array.from(e.target.options);
        const hasEngineeringOptions = opts.some(o => o.text.toLowerCase().includes("engineering") || o.text.toLowerCase().includes("technology") || o.text.toLowerCase().includes("science"));
        if (hasEngineeringOptions && e.target.selectedIndex > 0) {
            const selectedBranch = e.target.options[e.target.selectedIndex].text;
            const normSelected = normalizeBranchName(selectedBranch);
            
            const matches = window.currentPreferredList.filter(item => {
                const normItem = normalizeBranchName(item.coursePattern);
                return normItem === normSelected || normItem.includes(normSelected) || normSelected.includes(normItem);
            });
            
            if (matches.length > 0) {
                addSidebarLog(`<strong>🔎 You selected:</strong> ${selectedBranch}.<br>I found <strong>${matches.length} colleges</strong> in your list for this branch!<br><em>Click '⚡ Auto-Select' now!</em>`, "info");
            } else {
                addSidebarLog(`<strong>🔎 You selected:</strong> ${selectedBranch}.<br>You have <strong>0 colleges</strong> in your list for this branch.`, "warning");
            }
        }
    }
  });
}

// Listener for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "AUTO_SELECT_STEP1") {
    autoSelectStep1(request.preferredList);
    sendResponse({status: "Started Step 1"});
  } else if (request.action === "AUTO_SEARCH_MISSING") {
    autoSearchAndAddMissing(request.preferredList);
    sendResponse({status: "Started Auto Search"});
  } else if (request.action === "AUTO_ORDER_STEP2") {
    autoOrderStep2(request.preferredList);
    sendResponse({status: "Started Step 2"});
  } else if (request.action === "VERIFY_PREFERENCES") {
    verifyPreferences(request.preferredList);
    sendResponse({status: "Verification Started"});
  } else if (request.action === "INIT_SIDEBAR") {
    // BUG FIX: INIT_SIDEBAR now properly sets list and injects sidebar
    if (request.preferredList) {
      window.currentPreferredList = request.preferredList;
    }
    injectSidebar();
    setupLiveTracking(request.preferredList || window.currentPreferredList || []);
    updateSidebarCounter();
    sendResponse({status: "Sidebar Initialized"});
  }
  
  // For all other messages that carry a preferredList, inject sidebar and setup tracking
  if (request.preferredList && request.action !== "INIT_SIDEBAR") {
    injectSidebar();
    setupLiveTracking(request.preferredList);
  }
  
  return true; // BUG FIX: return true to keep the message channel open for async responses
});
