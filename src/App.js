import React, { useState, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { collection, addDoc, doc, getDoc, updateDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import SignatureCanvas from 'react-signature-canvas';
import jsPDF from 'jspdf';
import { TEMPLATES } from './templates';
// --- AUTH IMPORTS ---
import { useMsal, MsalAuthenticationTemplate } from "@azure/msal-react";
import { InteractionType } from "@azure/msal-browser";
import { loginRequest } from "./authConfig";

// --- STYLES ---
const styles = {
  container: { maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'Arial, sans-serif' },
  card: { border: '1px solid #ccc', borderRadius: '8px', padding: '20px', marginBottom: '20px', backgroundColor: '#fff' },
  inputGroup: { marginBottom: '15px' },
  input: { width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' },
  textarea: { width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', height: '80px', boxSizing: 'border-box' },
  btn: { padding: '12px 24px', backgroundColor: '#0056b3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', marginRight: '10px' },
  label: { display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '14px', color: '#333' },
  sigPad: { border: '1px solid #000', width: '100%', height: '150px', backgroundColor: '#f0f0f0' },
  sectionHeader: { marginTop: '20px', marginBottom: '10px', color: '#0056b3', borderBottom: '2px solid #eee', paddingBottom: '5px' },
  suggestions: { border: '1px solid #ccc', borderTop: 'none', maxHeight: '150px', overflowY: 'auto', backgroundColor: '#fff', position: 'absolute', width: '100%', zIndex: 1000, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' },
  suggestionItem: { padding: '10px', cursor: 'pointer', borderBottom: '1px solid #eee' },
  reportCard: { padding: '10px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', marginBottom: '5px', backgroundColor: '#f9f9f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  reportCardActive: { padding: '10px', border: '1px solid #2196f3', borderLeft: '5px solid #2196f3', borderRadius: '4px', cursor: 'pointer', marginBottom: '5px', backgroundColor: '#e3f2fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
};

// --- PDF GENERATOR ---
const generatePDF = (data) => {
  const doc = new jsPDF();
  const template = TEMPLATES[data.templateKey];
  let y = 20; const margin = 15; const contentWidth = 180;

  const addText = (text, size = 10, font = 'normal', color = 'black') => {
    doc.setFontSize(size); doc.setFont('helvetica', font); doc.setTextColor(color);
    const lines = doc.splitTextToSize(text, contentWidth);
    doc.text(lines, margin, y); y += (lines.length * size * 0.4) + 2; 
    return lines.length;
  };

  addText("SAS Retail Services", 16, 'bold', '#000000'); y -= 5;
  doc.setFontSize(8); doc.text("Revision Date 10/2020", 160, y); y += 10;
  doc.setFontSize(10); doc.text(`Associate Name: ${data.associateName}`, margin, y); doc.text(`Associate ID#: ${data.associateId}`, 105, y); y += 8;
  doc.text(`Supervisor Name: ${data.supervisorName}`, margin, y); y += 12;
  doc.setFillColor(230, 230, 230); doc.rect(margin, y - 6, contentWidth, 8, 'F');
  doc.setFont(undefined, 'bold'); doc.text("CORRECTIVE ACTION FORM", 105, y, null, null, "center"); y += 10;
  doc.setFont(undefined, 'normal'); doc.text(`Subject: ${template.subject}`, margin, y); doc.text(`Discussion Date: ${data.discussionDate}`, 105, y); y += 8;
  doc.text(`Program: ${data.program}`, margin, y); doc.text(`City/State/Store #: ${data.storeLocation}`, 105, y); y += 8;
  doc.text("Prior Notifications:", margin, y); doc.text(`Date: ${data.priorDate || 'N/A'}`, 80, y); doc.text(`Subject: ${data.priorSubject || 'N/A'}`, 130, y); y += 12;
  addText("SPECIFIC DETAILS OF CURRENT CONDUCT:", 10, 'bold');
  addText(data.details, 10, 'normal'); y += 5;
  addText("POLICY EXPECTATIONS:", 10, 'bold');
  addText(template.policy, 10, 'normal'); y += 5;
  addText("REQUIRED IMPROVEMENT:", 10, 'bold');
  addText(data.requiredImprovement, 10, 'normal'); y += 5;
  addText("ASSOCIATE COMMENTS:", 10, 'bold');
  addText(data.associateComments || "No comments provided.", 10, 'normal'); y += 5;

  if (y > 220) { doc.addPage(); y = 20; }
  doc.setFillColor(245, 245, 245); doc.rect(margin, y, contentWidth, 40, 'F'); y += 5;
  addText("ASSOCIATE ACKNOWLEDGMENT", 9, 'bold');
  doc.setFontSize(7); doc.text("By signing below, I acknowledge I have received and read the corrective action...", margin + 5, y + 5); y += 40;

  doc.setFont(undefined, 'bold'); doc.setFontSize(10);
  doc.text("Supervisor Signature:", margin, y);
  if (data.supervisorSignature) doc.addImage(data.supervisorSignature, 'PNG', margin, y + 2, 50, 15);
  doc.text(`Date: ${data.discussionDate}`, margin, y + 20);
  doc.text("Associate Signature:", 110, y);
  if (data.associateSignature) {
    doc.addImage(data.associateSignature, 'PNG', 110, y + 2, 50, 15);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 110, y + 20);
  } else {
    doc.text("(Pending Signature)", 110, y + 10);
  }
  doc.save(`${data.associateName}_CAF.pdf`);
};

// 1. Dashboard Component
const Dashboard = () => {
  const [cafs, setCafs] = useState([]);
  const [directReports, setDirectReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const { accounts } = useMsal();
  const userName = accounts[0]?.name || "Supervisor";
  const userId = accounts[0]?.localAccountId || "";

  // Fetch current user's direct reports
  useEffect(() => {
    const loadDirectReports = async () => {
      if (!userId) return;
      try {
        const res = await fetch(`/api/users?supervisorId=${userId}`);
        const data = await res.json();
        setDirectReports(data);
      } catch (error) { console.error("Error loading direct reports:", error); }
    };
    loadDirectReports();
  }, [userId]);

  // Fetch all CAFs and filter by direct reports
  useEffect(() => {
    const q = query(collection(db, "cafs"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCafs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Filter CAFs to only show those for my direct reports
  const directReportIds = directReports.map(dr => dr.id);
  const filteredCafs = directReportIds.length > 0
    ? cafs.filter(caf => directReportIds.includes(caf.associateId))
    : [];

  return (
    <div style={styles.container}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '20px'}}>
        <h2>{userName}'s Dashboard</h2>
        <Link to="/create"><button style={styles.btn}>+ Create New CAF</button></Link>
      </div>
      <hr />
      {loading ? (
        <p>Loading...</p>
      ) : filteredCafs.length === 0 ? (
        <p style={{textAlign: 'center', color: '#666', padding: '40px'}}>
          No corrective action forms found for your direct reports.
        </p>
      ) : (
        filteredCafs.map(caf => (
          <div key={caf.id} style={styles.card}>
            <h3>{caf.associateName} - {TEMPLATES[caf.templateKey]?.label}</h3>
            <p>Status: <strong style={{color: caf.status === 'Completed' ? 'green' : 'orange'}}>{caf.status}</strong></p>
            <p style={{fontSize: '0.85em', color: '#666'}}>Created by: {caf.supervisorName}</p>
            {caf.status === 'Completed' ? (
               <button style={styles.btn} onClick={() => generatePDF(caf)}>Download Completed PDF</button>
            ) : (
               <div>
                 <p>Send this link to associate:</p>
                 <code style={{background:'#eee', padding:'10px', display:'block', wordBreak:'break-all'}}>
                   {window.location.href.split('#')[0]}#/sign/{caf.id}
                 </code>
               </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

// 2. Create Form Component
const CreateCAF = () => {
  const navigate = useNavigate();
  const sigPad = useRef({});
  const { accounts } = useMsal();

  // Auto-fill supervisor name and ID from Azure AD
  const currentUser = accounts[0]?.name || "";
  const currentUserId = accounts[0]?.localAccountId || "";

  const [supervisorSearch, setSupervisorSearch] = useState(currentUser);
  const [searchResults, setSearchResults] = useState([]);
  const [directReports, setDirectReports] = useState([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    templateKey: 'attendance',
    associateName: '', associateId: '',
    supervisorName: currentUser,
    discussionDate: new Date().toISOString().split('T')[0],
    program: '', storeLocation: '', priorDate: '', priorSubject: '',
    details: '', requiredImprovement: ''
  });

  // Auto-load current user's direct reports on mount
  useEffect(() => {
    const loadMyDirectReports = async () => {
      if (!currentUserId) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/users?supervisorId=${currentUserId}`);
        const data = await res.json();
        setDirectReports(data);
      } catch (error) { console.error("Error loading direct reports:", error); }
      setLoading(false);
    };
    loadMyDirectReports();
  }, [currentUserId]);

  // API Search
  const searchUsers = async (term) => {
    setSupervisorSearch(term);
    if (term.length < 3) { setSearchResults([]); return; }
    try {
      const res = await fetch(`/api/users?search=${term}`);
      const data = await res.json();
      setSearchResults(data);
    } catch (error) { console.error("API Error:", error); }
  };

  const selectSupervisor = async (user) => {
    setSupervisorSearch(user.displayName);
    setFormData({ ...formData, supervisorName: user.displayName });
    setSearchResults([]);
    setLoading(true);
    try {
      const res = await fetch(`/api/users?supervisorId=${user.id}`);
      const data = await res.json();
      setDirectReports(data);
    } catch (error) { console.error("API Error:", error); }
    setLoading(false);
  };

  const selectAssociate = (associate) => {
    setFormData({
      ...formData,
      associateName: associate.displayName,
      associateId: associate.id 
    });
  };

  const handleChange = (e) => setFormData({...formData, [e.target.name]: e.target.value});
  
  const handleSubmit = async () => {
    if (sigPad.current.isEmpty()) return alert("Please sign the document");
    await addDoc(collection(db, "cafs"), {
      ...formData,
      supervisorSignature: sigPad.current.toDataURL(),
      status: 'Pending Associate',
      associateComments: '',
      timestamp: new Date()
    });
    navigate('/');
  };

  return (
    <div style={styles.container}>
      <Link to="/" style={{textDecoration:'none', color:'#666'}}>← Back to Dashboard</Link>
      <h2>Create Corrective Action Form</h2>
      <div style={styles.card}>
        <h3 style={styles.sectionHeader}>1. General Information</h3>
        <div style={{...styles.inputGroup, position: 'relative'}}>
            <label style={styles.label}>Supervisor Name (Search Directory)</label>
            <input style={styles.input} value={supervisorSearch} 
              onChange={(e) => searchUsers(e.target.value)}
              placeholder="Search supervisor..." />
            {searchResults.length > 0 && (
              <div style={styles.suggestions}>
                {searchResults.map((u) => (
                    <div key={u.id} style={styles.suggestionItem} onClick={() => selectSupervisor(u)}>
                      <strong>{u.displayName}</strong> ({u.jobTitle || 'No Title'})
                    </div>
                ))}
              </div>
            )}
        </div>

        {loading && <p>Loading reports...</p>}
        {directReports.length > 0 && (
            <div style={{marginBottom: '20px'}}>
                <label style={styles.label}>Select Associate:</label>
                <div style={{maxHeight:'200px', overflowY:'auto', border:'1px solid #eee', padding:'5px'}}>
                    {directReports.map(report => (
                        <div key={report.id} 
                          style={formData.associateId === report.id ? styles.reportCardActive : styles.reportCard}
                          onClick={() => selectAssociate(report)}>
                            <span>{report.displayName}</span>
                            <span style={{fontSize:'0.8em', color:'#666'}}>{report.jobTitle}</span>
                        </div>
                    ))}
                </div>
            </div>
        )}

        <div style={{display:'flex', gap:'10px'}}>
          <div style={{flex:1}}>
            <label style={styles.label}>Associate Name</label>
            <input style={styles.input} name="associateName" value={formData.associateName} onChange={handleChange} />
          </div>
          <div style={{flex:1}}>
             <label style={styles.label}>Associate ID / Email</label>
             <input style={styles.input} name="associateId" value={formData.associateId} onChange={handleChange} />
          </div>
        </div>

        <div style={styles.inputGroup}>
            <label style={styles.label}>Discussion Date</label>
            <input type="date" style={styles.input} name="discussionDate" value={formData.discussionDate} onChange={handleChange} />
        </div>
        
        <div style={{display:'flex', gap:'10px'}}>
          <div style={{flex:1}}>
            <label style={styles.label}>Program</label>
            <input style={styles.input} name="program" onChange={handleChange} />
          </div>
          <div style={{flex:1}}>
             <label style={styles.label}>City/State or Store #</label>
             <input style={styles.input} name="storeLocation" onChange={handleChange} />
          </div>
        </div>

        <h3 style={styles.sectionHeader}>2. Details</h3>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Infraction Type</label>
          <select style={styles.input} name="templateKey" value={formData.templateKey} onChange={handleChange}>
            {Object.entries(TEMPLATES).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </div>
        <textarea style={styles.textarea} name="details" placeholder="Infraction details..." onChange={handleChange} />
        <div style={styles.inputGroup}>
          <label style={styles.label}>Required Improvement</label>
          <textarea style={styles.textarea} name="requiredImprovement" placeholder="Expectations..." onChange={handleChange} />
        </div>
        <label style={styles.label}><br/>Supervisor Signature</label>
        <SignatureCanvas penColor='black' canvasProps={{className: 'sigPad', style: styles.sigPad}} ref={sigPad} />
      </div>
      <button style={styles.btn} onClick={handleSubmit}>Save & Generate Link</button>
    </div>
  );
};

// 3. Associate View (Publicly Accessible for Signing)
const AssociateSign = () => {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [comments, setComments] = useState('');
  const sigPad = useRef({});
  useEffect(() => {
    getDoc(doc(db, "cafs", id)).then(snap => setData({id: snap.id, ...snap.data()}));
  }, [id]);
  const handleSign = async () => {
    if (sigPad.current.isEmpty()) return alert("Please sign the document");
    const updatedData = { ...data, associateComments: comments, associateSignature: sigPad.current.toDataURL(), status: 'Completed' };
    await updateDoc(doc(db, "cafs", id), updatedData);
    generatePDF(updatedData);
    setData(updatedData);
  };
  if (!data) return <div>Loading...</div>;
  if (data.status === 'Completed') return <div style={styles.container}><h2>Document Completed</h2></div>;
  return (
    <div style={styles.container}>
      <h2>Review Corrective Action Form</h2>
      <div style={styles.card}>
        <p><strong>Associate:</strong> {data.associateName}</p>
        <p><strong>Subject:</strong> {TEMPLATES[data.templateKey]?.label}</p>
        <p><strong>Details:</strong> {data.details}</p>
      </div>
      <div style={styles.card}>
        <label style={styles.label}>Associate Comments</label>
        <textarea style={styles.textarea} value={comments} onChange={(e) => setComments(e.target.value)} />
        <label style={styles.label}>Associate Signature</label>
        <SignatureCanvas penColor='black' canvasProps={{className: 'sigPad', style: styles.sigPad}} ref={sigPad} />
      </div>
      <button style={styles.btn} onClick={handleSign}>Sign & Finish</button>
    </div>
  );
};

// --- MAIN ROUTER with AUTH PROTECTION ---
export default function App() {
  return (
    <Router>
      <Routes>
        {/* Protected Routes: Require Login */}
        <Route path="/" element={
          <MsalAuthenticationTemplate interactionType={InteractionType.Redirect} authenticationRequest={loginRequest}>
            <Dashboard />
          </MsalAuthenticationTemplate>
        } />
        <Route path="/create" element={
          <MsalAuthenticationTemplate interactionType={InteractionType.Redirect} authenticationRequest={loginRequest}>
            <CreateCAF />
          </MsalAuthenticationTemplate>
        } />
        
        {/* Public Route: Associate can sign without login */}
        <Route path="/sign/:id" element={<AssociateSign />} />
      </Routes>
    </Router>
  );
}