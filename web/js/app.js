/**
 * Election Commission Management System (ECMS)
 * Frontend Application Controller
 */

let currentUser = null;
let currentVoter = null;
let allConstituencies = [];
let allParties = [];
let allCandidates = [];

document.addEventListener("DOMContentLoaded", () => {
    // Check if user session exists in sessionStorage
    const savedUser = sessionStorage.getItem("ecms_user");
    const savedVoter = sessionStorage.getItem("ecms_voter");
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        if (savedVoter && savedVoter !== "null") {
            currentVoter = JSON.parse(savedVoter);
        }
        updateHeaderAuthUI();
    }

    loadConstituencies();
    loadParties();
    loadElectionResults();
    loadSqlScript();

    // Auto refresh results every 10 seconds
    setInterval(() => {
        const resultsSection = document.getElementById("section-results");
        if (resultsSection && resultsSection.classList.contains("active")) {
            loadElectionResults();
        }
    }, 10000);
});

// Tab Navigation
function switchTab(tabId) {
    document.querySelectorAll(".content-section").forEach(sec => sec.classList.remove("active"));
    document.querySelectorAll(".nav-tab").forEach(tab => tab.classList.remove("active"));

    const targetSec = document.getElementById(`section-${tabId}`);
    if (targetSec) targetSec.classList.add("active");

    const activeBtn = Array.from(document.querySelectorAll(".nav-tab")).find(btn => 
        btn.getAttribute("onclick") && btn.getAttribute("onclick").includes(`'${tabId}'`)
    );
    if (activeBtn) activeBtn.classList.add("active");

    // Dynamic tab actions
    if (tabId === "ballot") {
        renderBallotView();
    } else if (tabId === "results") {
        loadElectionResults();
    } else if (tabId === "admin") {
        if (!currentUser || (currentUser.role !== "ADMIN" && currentUser.role !== "OFFICER")) {
            showAlert("loginAlertBox", "Administrative clearance required. Please log in with EC official credentials.", "warning");
            switchTab("login");
            return;
        }
        loadAdminData();
    } else if (tabId === "update") {
        loadVotersForUpdateTab();
    } else if (tabId === "sql") {
        loadSqlScript();
    }
}

// Authentication
function handleAuthAction() {
    if (currentUser) {
        // Logout
        currentUser = null;
        currentVoter = null;
        sessionStorage.removeItem("ecms_user");
        sessionStorage.removeItem("ecms_voter");
        updateHeaderAuthUI();
        switchTab("login");
        showAlert("loginAlertBox", "You have been securely logged out.", "info");
    } else {
        switchTab("login");
    }
}

function updateHeaderAuthUI() {
    const badgeBar = document.getElementById("userBadgeBar");
    const roleBadge = document.getElementById("userRoleBadge");
    const nameDisplay = document.getElementById("userNameDisplay");
    const authBtn = document.getElementById("authBtn");
    const loginTabBtn = document.getElementById("loginTabBtn");

    if (currentUser) {
        roleBadge.textContent = currentUser.role;
        roleBadge.className = `role-pill ${currentUser.role === 'ADMIN' ? 'role-admin' : 'role-voter'}`;
        nameDisplay.textContent = currentUser.fullName + (currentVoter ? ` (${currentVoter.epicNo})` : "");
        authBtn.textContent = "Logout";
        if (loginTabBtn) loginTabBtn.style.display = "none";
    } else {
        roleBadge.textContent = "Guest";
        roleBadge.className = "role-pill role-guest";
        nameDisplay.textContent = "Not Logged In";
        authBtn.textContent = "Login";
        if (loginTabBtn) loginTabBtn.style.display = "inline-flex";
    }
}

function quickLogin(u, p) {
    document.getElementById("loginUsername").value = u;
    document.getElementById("loginPassword").value = p;
    document.getElementById("loginForm").dispatchEvent(new Event("submit"));
}

async function submitLogin(e) {
    e.preventDefault();
    const u = document.getElementById("loginUsername").value.trim();
    const p = document.getElementById("loginPassword").value.trim();

    try {
        const res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: u, password: p })
        });
        const data = await res.json();

        if (data.success) {
            currentUser = data.user;
            currentVoter = data.voter;
            sessionStorage.setItem("ecms_user", JSON.stringify(currentUser));
            sessionStorage.setItem("ecms_voter", JSON.stringify(currentVoter));
            updateHeaderAuthUI();

            if (currentUser.role === "ADMIN" || currentUser.role === "OFFICER") {
                switchTab("admin");
            } else {
                switchTab("ballot");
            }
        } else {
            showAlert("loginAlertBox", data.message || "Login failed.", "danger");
        }
    } catch (err) {
        showAlert("loginAlertBox", "Server connectivity error: " + err.message, "danger");
    }
}

// Age Calculation & Voter Registration
function calculateLiveAge() {
    const dobInput = document.getElementById("regDob").value;
    const feedback = document.getElementById("ageFeedback");
    if (!dobInput) return;

    const dob = new Date(dobInput);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
        age--;
    }

    if (isNaN(age) || age < 0) {
        feedback.innerHTML = `<span style="color: red;">Invalid Date of Birth.</span>`;
        return;
    }

    if (age >= 18) {
        feedback.innerHTML = `<span style="color: #15803d; font-weight: bold;">✅ Age: ${age} Years — Fully Eligible for Registration (Article 326)</span>`;
    } else {
        feedback.innerHTML = `<span style="color: #b91c1c; font-weight: bold;">❌ Age: ${age} Years — Ineligible (Minimum 18 years required)</span>`;
    }
}

async function submitRegistration(e) {
    e.preventDefault();
    const fullName = document.getElementById("regFullName").value.trim();
    const dob = document.getElementById("regDob").value;
    const gender = document.getElementById("regGender").value;
    const constituencyId = document.getElementById("regConstituency").value;
    const phone = document.getElementById("regPhone").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const address = document.getElementById("regAddress").value.trim();
    const username = document.getElementById("regUsername").value.trim();
    const password = document.getElementById("regPassword").value.trim();

    try {
        const res = await fetch("/api/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                fullName, dob, gender, constituencyId,
                phone, email, address, username, password
            })
        });
        const data = await res.json();

        if (data.success) {
            showAlert("regAlertBox", `
                <strong>${data.message}</strong><br>
                Official EPIC Voter ID Issued: <strong style="font-size: 1.1rem; color: #15803d;">${data.epicNo}</strong><br>
                Assigned Age: ${data.age} | Username: <code>${data.username}</code><br>
                You may now <a href="#" onclick="quickLogin('${username}', '${password}')" style="font-weight: bold; text-decoration: underline;">Click Here to Log In</a> and cast your vote!
            `, "success");
            document.getElementById("registerForm").reset();
            document.getElementById("ageFeedback").textContent = "";
        } else {
            showAlert("regAlertBox", data.message, "danger");
        }
    } catch (err) {
        showAlert("regAlertBox", "Registration service error: " + err.message, "danger");
    }
}

// Ballot View & Electronic Voting Machine
async function renderBallotView() {
    const promptBox = document.getElementById("ballotLoginPrompt");
    const profileCard = document.getElementById("voterProfileCard");
    const evmBox = document.getElementById("evmBallotContainer");
    const vvpatBox = document.getElementById("vvpatDisplayContainer");

    vvpatBox.style.display = "none";

    if (!currentUser || currentUser.role !== "VOTER" || !currentVoter) {
        promptBox.style.display = "block";
        profileCard.style.display = "none";
        evmBox.style.display = "none";
        return;
    }

    promptBox.style.display = "none";
    profileCard.style.display = "block";

    // Populate voter profile card
    document.getElementById("dispEpic").textContent = currentVoter.epicNo;
    document.getElementById("dispName").textContent = currentVoter.fullName;
    document.getElementById("dispConst").textContent = `${currentVoter.constituencyName} (${currentVoter.constituencyState})`;
    document.getElementById("dispAgeGender").textContent = `${currentVoter.age} Yrs / ${currentVoter.gender}`;

    const badge = document.getElementById("voterStatusBadge");
    if (currentVoter.hasVoted) {
        badge.textContent = "Ballot Already Cast";
        badge.className = "role-pill role-admin";
        evmBox.style.display = "block";
        document.getElementById("ballotConstTitle").textContent = currentVoter.constituencyName;
        showAlert("ballotAlertBox", `
            🛡️ <strong>BALLOT RECORDED:</strong> You have already cast your vote in this election!
            Under Section 171E of IPC, duplicate voting is strictly prohibited. Thank you for participating in Indian Democracy.
        `, "warning");
        await loadBallotCandidates(currentVoter.constituencyId, true);
    } else {
        badge.textContent = "Eligible to Vote";
        badge.className = "role-pill role-voter";
        evmBox.style.display = "block";
        document.getElementById("ballotConstTitle").textContent = currentVoter.constituencyName;
        document.getElementById("ballotAlertBox").innerHTML = "";
        await loadBallotCandidates(currentVoter.constituencyId, false);
    }
}

async function loadBallotCandidates(constituencyId, disableButtons) {
    const container = document.getElementById("ballotRowsList");
    container.innerHTML = "<div style='padding: 1.5rem; text-align: center;'>Loading candidates via JDBC...</div>";

    try {
        const res = await fetch(`/api/candidates?constituencyId=${constituencyId}`);
        const candidates = await res.json();

        if (!candidates || candidates.length === 0) {
            container.innerHTML = "<div style='padding: 1.5rem; text-align: center; color: var(--text-muted);'>No candidates registered for this constituency.</div>";
            return;
        }

        let html = "";
        candidates.forEach((c, idx) => {
            const symbolIcons = { "Lotus": "🪷", "Hand": "✋", "Broom": "🧹", "Kite": "🪁" };
            const icon = symbolIcons[c.symbol] || "🗳️";

            html += `
                <div class="ballot-row">
                    <div class="cand-serial">${idx + 1}</div>
                    <div class="cand-details">
                        <h3>${c.fullName}</h3>
                        <p>Education: <strong>${c.education}</strong> | Age: <strong>${c.age}</strong></p>
                        <p style="font-size: 0.75rem; color: ${c.criminalCases > 0 ? '#b91c1c' : '#15803d'};">
                            Declared Criminal Cases: <strong>${c.criminalCases}</strong> | Declared Assets: <strong>₹${(c.assetsDeclared/10000000).toFixed(2)} Cr</strong>
                        </p>
                    </div>
                    <div class="party-badge">
                        <span class="symbol-icon">${icon}</span>
                        <span>${c.partyAbbreviation}</span>
                    </div>
                    <div>
                        <button class="evm-btn" ${disableButtons ? "disabled" : ""} 
                                onclick="castVote(${c.candidateId}, '${escapeJs(c.fullName)}', '${escapeJs(c.partyName)}')">
                            ${disableButtons ? "VOTED" : "VOTE / मत दें"}
                        </button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (err) {
        container.innerHTML = "<div style='padding: 1rem; color: red;'>Error retrieving candidate roster: " + err.message + "</div>";
    }
}

async function castVote(candidateId, candidateName, partyName) {
    if (!currentVoter) return;

    const confirmVote = confirm(`Please Confirm Your Choice:\n\nCandidate: ${candidateName}\nParty: ${partyName}\n\nYour vote will be recorded permanently in the blockchain/database ledger. Proceed?`);
    if (!confirmVote) return;

    try {
        const res = await fetch("/api/vote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                voterId: currentVoter.voterId,
                candidateId: candidateId
            })
        });
        const data = await res.json();

        if (data.success) {
            currentVoter.hasVoted = true;
            sessionStorage.setItem("ecms_voter", JSON.stringify(currentVoter));

            // Hide EVM and show VVPAT slip
            document.getElementById("evmBallotContainer").style.display = "none";
            const vvpatBox = document.getElementById("vvpatDisplayContainer");
            vvpatBox.style.display = "block";

            const r = data.receipt;
            document.getElementById("vvpatEpic").textContent = r.epicNo;
            document.getElementById("vvpatVoter").textContent = r.voterName;
            document.getElementById("vvpatCandidate").textContent = r.candidateName;
            document.getElementById("vvpatParty").textContent = r.partyName;
            document.getElementById("vvpatSymbol").textContent = r.symbol;
            document.getElementById("vvpatTime").textContent = r.timestamp;
            document.getElementById("vvpatHash").textContent = r.ballotHash;

            // Refresh election results in background
            loadElectionResults();
        } else {
            showAlert("ballotAlertBox", data.message, "danger");
        }
    } catch (err) {
        showAlert("ballotAlertBox", "Voting transaction failed: " + err.message, "danger");
    }
}

// Live Election Results & Analytics
async function loadElectionResults() {
    try {
        const [statsRes, resultsRes] = await Promise.all([
            fetch("/api/admin/stats"),
            fetch("/api/results")
        ]);

        const stats = await statsRes.json();
        const results = await resultsRes.json();

        // Populate KPIs
        document.getElementById("kpiTotalVoters").textContent = stats.totalVoters.toLocaleString();
        document.getElementById("kpiTotalVotes").textContent = stats.totalVotes.toLocaleString();
        document.getElementById("kpiTurnout").textContent = `${stats.turnout.toFixed(2)}%`;
        document.getElementById("kpiTurnoutBar").style.width = `${Math.min(100, stats.turnout)}%`;

        allCandidates = results.candidates || [];
        renderFilteredResults();

    } catch (err) {
        console.error("Failed to load results", err);
    }
}

function renderFilteredResults() {
    const filterVal = document.getElementById("resultsConstFilter").value;
    const tbody = document.getElementById("resultsTableBody");

    let list = allCandidates;
    if (filterVal !== "ALL") {
        list = allCandidates.filter(c => c.constituencyId == filterVal);
    }

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No candidates recorded.</td></tr>`;
        return;
    }

    // Determine leading candidate per constituency
    const maxVotesPerConst = {};
    allCandidates.forEach(c => {
        if (!maxVotesPerConst[c.constituencyId] || c.votesCount > maxVotesPerConst[c.constituencyId]) {
            maxVotesPerConst[c.constituencyId] = c.votesCount;
        }
    });

    let html = "";
    list.forEach(c => {
        const isLeading = c.votesCount > 0 && c.votesCount === maxVotesPerConst[c.constituencyId];
        const symbolIcons = { "Lotus": "🪷", "Hand": "✋", "Broom": "🧹", "Kite": "🪁" };
        const icon = symbolIcons[c.symbol] || "🗳️";

        html += `
            <tr>
                <td><strong>${c.constituencyName}</strong></td>
                <td><strong>${c.fullName}</strong></td>
                <td>${c.partyName} (${c.partyAbbreviation})</td>
                <td style="font-size: 1.2rem;">${icon}</td>
                <td><strong style="color: var(--primary); font-size: 1rem;">${c.votesCount}</strong></td>
                <td style="min-width: 140px;">
                    <div>${c.votePercentage.toFixed(1)}%</div>
                    <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${c.votePercentage}%;"></div></div>
                </td>
                <td>
                    ${isLeading ? '<span class="role-pill role-voter" style="background: #15803d;">🏆 Leading / Winner</span>' : '<span style="color: var(--text-muted); font-size: 0.8rem;">Contesting</span>'}
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// Admin SubTabs & Operations
function switchAdminSubTab(sub) {
    document.getElementById("adminSubVoters").style.display = sub === "voters" ? "block" : "none";
    const constTab = document.getElementById("adminSubConstituencies");
    if (constTab) constTab.style.display = sub === "constituencies" ? "block" : "none";
    document.getElementById("adminSubCandidates").style.display = sub === "candidates" ? "block" : "none";
    document.getElementById("adminSubLogs").style.display = sub === "logs" ? "block" : "none";

    document.getElementById("adminSubVotersBtn").className = `btn btn-sm ${sub === 'voters' ? 'btn-primary' : 'btn-outline'}`;
    const constBtn = document.getElementById("adminSubConstBtn");
    if (constBtn) constBtn.className = `btn btn-sm ${sub === 'constituencies' ? 'btn-primary' : 'btn-outline'}`;
    document.getElementById("adminSubCandBtn").className = `btn btn-sm ${sub === 'candidates' ? 'btn-primary' : 'btn-outline'}`;
    document.getElementById("adminSubLogsBtn").className = `btn btn-sm ${sub === 'logs' ? 'btn-primary' : 'btn-outline'}`;

    if (sub === "voters") loadAdminVoters();
    if (sub === "constituencies") renderAdminConstituenciesTable();
    if (sub === "logs") loadAdminLogs();
}

async function loadAdminData() {
    loadAdminVoters();
    renderAdminConstituenciesTable();
    loadAdminLogs();
}

let cachedVoters = [];
async function loadAdminVoters() {
    try {
        const res = await fetch("/api/admin/voters");
        cachedVoters = await res.json();
        renderVoterRollTable(cachedVoters);
    } catch (err) {
        console.error("Voter roll error:", err);
    }
}

function renderVoterRollTable(voters) {
    const tbody = document.getElementById("adminVoterRollBody");
    if (!voters || voters.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center;">No voters registered.</td></tr>`;
        return;
    }

    let html = "";
    voters.forEach(v => {
        html += `
            <tr>
                <td><code>${v.epicNo}</code></td>
                <td><strong>${v.fullName}</strong></td>
                <td>${v.age}</td>
                <td>${v.gender}</td>
                <td>${v.constituencyName}</td>
                <td>${v.phone}</td>
                <td>
                    <span class="role-pill ${v.hasVoted ? 'role-admin' : 'role-voter'}">
                        ${v.hasVoted ? 'YES (Voted)' : 'NO (Pending)'}
                    </span>
                </td>
                <td style="font-size: 0.75rem; color: var(--text-muted);">${v.votedAt}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

function filterVoterRoll() {
    const q = document.getElementById("voterSearchInput").value.toLowerCase();
    const filtered = cachedVoters.filter(v => 
        v.fullName.toLowerCase().includes(q) || v.epicNo.toLowerCase().includes(q)
    );
    renderVoterRollTable(filtered);
}

async function loadAdminLogs() {
    try {
        const res = await fetch("/api/admin/audit-logs");
        const logs = await res.json();
        const tbody = document.getElementById("adminAuditLogBody");

        let html = "";
        logs.forEach(l => {
            html += `
                <tr>
                    <td>#${l.id}</td>
                    <td><code>${l.action}</code></td>
                    <td><strong>${l.user}</strong></td>
                    <td>${l.desc}</td>
                    <td style="font-size: 0.78rem; color: var(--text-muted);">${l.time}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html || `<tr><td colspan="5" style="text-align: center;">No audit logs yet.</td></tr>`;
    } catch (err) {
        console.error("Audit log error:", err);
    }
}

async function submitCandidateNomination(e) {
    e.preventDefault();
    const fullName = document.getElementById("candName").value.trim();
    const partyId = document.getElementById("candParty").value;
    const constituencyId = document.getElementById("candConstituency").value;
    const age = document.getElementById("candAge").value;
    const education = document.getElementById("candEdu").value.trim();
    const criminalCases = document.getElementById("candCriminal").value;
    const assetsDeclared = document.getElementById("candAssets").value;

    try {
        const res = await fetch("/api/admin/candidates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                fullName, partyId, constituencyId, age, education, criminalCases, assetsDeclared
            })
        });
        const data = await res.json();

        if (data.success) {
            showAlert("candidateNomAlert", data.message, "success");
            document.getElementById("candidateNomForm").reset();
            loadElectionResults();
        } else {
            showAlert("candidateNomAlert", data.message, "danger");
        }
    } catch (err) {
        showAlert("candidateNomAlert", "Nomination submission error: " + err.message, "danger");
    }
}

async function submitConstituencyCreation(e) {
    e.preventDefault();
    const name = document.getElementById("newConstName").value.trim();
    const state = document.getElementById("newConstState").value.trim();
    const status = document.getElementById("newConstStatus").value;

    try {
        const res = await fetch("/api/admin/constituency", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, state, status })
        });
        const data = await res.json();

        if (data.success) {
            showAlert("constituencyCreateAlert", `
                <strong>${data.message}</strong><br>
                Executed DML Command via JDBC:<br>
                <code>${escapeJs(data.dmlExecuted)}</code><br>
                Generated Constituency ID: <strong>#${data.constituencyId}</strong> | State: <strong>${data.state}</strong><br>
                All registration and ballot dropdowns across the application have been dynamically synchronized.
            `, "success");
            document.getElementById("constituencyCreateForm").reset();
            await loadConstituencies();
            renderAdminConstituenciesTable();
        } else {
            showAlert("constituencyCreateAlert", data.message, "danger");
        }
    } catch (err) {
        showAlert("constituencyCreateAlert", "Constituency creation error: " + err.message, "danger");
    }
}

async function renderAdminConstituenciesTable() {
    const tbody = document.getElementById("adminConstListBody");
    if (!tbody) return;

    try {
        const res = await fetch("/api/constituencies");
        const list = await res.json();
        allConstituencies = list;

        if (!list || list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No constituencies recorded.</td></tr>`;
            return;
        }

        let html = "";
        list.forEach(c => {
            html += `
                <tr>
                    <td><strong>#${c.constituencyId}</strong></td>
                    <td><strong>${c.name}</strong></td>
                    <td>${c.state}</td>
                    <td><span class="role-pill role-voter">${c.totalVoters} Electors</span></td>
                    <td><span class="role-pill ${c.status === 'ACTIVE' ? 'role-voter' : 'role-admin'}">${c.status}</span></td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    } catch (err) {
        console.error("Failed to render constituencies table", err);
    }
}

// Helpers: Dropdown populations & SQL Script Viewer
async function loadConstituencies() {
    try {
        const res = await fetch("/api/constituencies");
        allConstituencies = await res.json();

        // Populate registration dropdown
        const regSelect = document.getElementById("regConstituency");
        regSelect.innerHTML = `<option value="">Select Assembly Constituency</option>`;
        allConstituencies.forEach(c => {
            regSelect.innerHTML += `<option value="${c.constituencyId}">${c.name} (${c.state})</option>`;
        });

        // Populate filter dropdown
        const filterSelect = document.getElementById("resultsConstFilter");
        filterSelect.innerHTML = `<option value="ALL">All Constituencies (Overview)</option>`;
        allConstituencies.forEach(c => {
            filterSelect.innerHTML += `<option value="${c.constituencyId}">${c.name} (${c.state})</option>`;
        });

        // Populate admin candidate nomination dropdown
        const candConstSelect = document.getElementById("candConstituency");
        if (candConstSelect) {
            candConstSelect.innerHTML = `<option value="">Select Constituency</option>`;
            allConstituencies.forEach(c => {
                candConstSelect.innerHTML += `<option value="${c.constituencyId}">${c.name} (${c.state})</option>`;
            });
        }

    } catch (err) {
        console.error("Constituency load error:", err);
    }
}

async function loadParties() {
    try {
        const res = await fetch("/api/parties");
        allParties = await res.json();

        const candPartySelect = document.getElementById("candParty");
        if (candPartySelect) {
            candPartySelect.innerHTML = `<option value="">Select Political Party</option>`;
            allParties.forEach(p => {
                candPartySelect.innerHTML += `<option value="${p.partyId}">${p.partyName} (${p.abbreviation} - ${p.symbol})</option>`;
            });
        }
    } catch (err) {
        console.error("Parties load error:", err);
    }
}

async function loadSqlScript() {
    const pre = document.getElementById("sqlViewerPre");
    try {
        const res = await fetch("/api/sql-script");
        const script = await res.text();
        pre.textContent = script;
    } catch (err) {
        pre.textContent = "-- Error loading database/DDL_DML.sql: " + err.message;
    }
}

function copySqlCode() {
    const text = document.getElementById("sqlViewerPre").textContent;
    navigator.clipboard.writeText(text).then(() => {
        alert("SQL DDL and DML Script copied to clipboard successfully!");
    });
}

function showAlert(containerId, htmlMessage, type) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `<div class="alert alert-${type}">${htmlMessage}</div>`;
}

function escapeJs(str) {
    if (!str) return "";
    return str.replace(/'/g, "\\'");
}

// Form 8: Updation of Elector Records
async function loadVotersForUpdateTab() {
    try {
        const res = await fetch("/api/admin/voters");
        const voters = await res.json();
        const select = document.getElementById("updateVoterSelect");
        if (!select) return;
        select.innerHTML = '<option value="">Select Elector to Update</option>';
        voters.forEach(v => {
            select.innerHTML += `<option value="${v.voterId}" data-phone="${v.phone}" data-address="${escapeJs(v.address || '')}">${v.fullName} (${v.epicNo}) - ${v.constituencyName}</option>`;
        });
        if (currentVoter) {
            select.value = currentVoter.voterId;
            populateUpdateFields();
        }
    } catch (err) {
        console.error("Failed to load electors for update", err);
    }
}

function populateUpdateFields() {
    const select = document.getElementById("updateVoterSelect");
    if (!select) return;
    const opt = select.options[select.selectedIndex];
    if (opt && opt.dataset.phone) {
        document.getElementById("updatePhone").value = opt.dataset.phone;
        document.getElementById("updateAddress").value = opt.dataset.address || "Sector 14, New Delhi";
    }
}

async function submitVoterUpdate(e) {
    e.preventDefault();
    const voterId = document.getElementById("updateVoterSelect").value;
    const phone = document.getElementById("updatePhone").value.trim();
    const address = document.getElementById("updateAddress").value.trim();
    const email = document.getElementById("updateEmail").value.trim();

    try {
        const res = await fetch("/api/voter/update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ voterId, phone, address, email })
        });
        const data = await res.json();

        if (data.success) {
            showAlert("updateAlertBox", `
                <strong>${data.message}</strong><br>
                Executed SQL Query via JDBC:<br>
                <code>UPDATE voters SET address = '${escapeJs(address)}', phone = '${escapeJs(phone)}' WHERE voter_id = ${voterId};</code><br>
                The updated elector particulars are now live in the database.
            `, "success");
            loadAdminVoters();
        } else {
            showAlert("updateAlertBox", data.message, "danger");
        }
    } catch (err) {
        showAlert("updateAlertBox", "Update request failed: " + err.message, "danger");
    }
}

