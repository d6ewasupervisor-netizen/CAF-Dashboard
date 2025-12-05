import React, { useState, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { collection, addDoc, doc, getDoc, updateDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import SignatureCanvas from 'react-signature-canvas';
import jsPDF from 'jspdf';
import { TEMPLATES } from './templates';

// --- STYLES ---
const styles = {
  container: { maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'Arial, sans-serif' },
  card: { border: '1px solid #ccc', borderRadius: '8px', padding: '20px', marginBottom: '20px', backgroundColor: '#fff' },
  inputGroup: { marginBottom: '15px' },
  input: { width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' },
  textarea: { width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', height: '80px', boxSizing: 'border-box' },
  btn: { padding: '12px 24px', backgroundColor: '#0056b3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' },
  label: { display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '14px', color: '#333' },
  sigPad: { border: '1px solid #000', width: '100%', height: '150px', backgroundColor: '#f0f0f0' },
  sectionHeader: { marginTop: '20px', marginBottom: '10px', color: '#0056b3', borderBottom: '2px solid #eee', paddingBottom: '5px' }
};

// --- PDF GENERATOR (Professional Layout) ---
const generatePDF = (data) => {
  const doc = new jsPDF();
  const template = TEMPLATES[data.templateKey];
  let y = 20; // Current Y position tracker
  const margin = 15;
  const contentWidth = 180;

  // Helper to add text and move Y
  const addText = (text, size = 10, font = 'normal', color = 'black') => {
    doc.setFontSize(size);
    doc.setFont('helvetica', font);
    doc.setTextColor(color);
    const lines = doc.splitTextToSize(text, contentWidth);
    doc.text(lines, margin, y);
    y += (lines.length * size * 0.4) + 2; 
    return lines.length;
  };

  // Header
  addText("SAS Retail Services", 16, 'bold', '#000000');
  y -= 5;
  doc.setFontSize(8);
  doc.text("Revision Date 10/2020", 160, y);
  y += 10;

  // Row 1: Associate Info
  doc.setFontSize(10);
  doc.text(`Associate Name: ${data.associateName}`, margin, y);
  doc.text(`Associate ID#: ${data.associateId}`, 105, y);
  y += 8;
  doc.text(`Supervisor Name: ${data.supervisorName}`, margin, y);
  y += 12;

  // Title
  doc.setFillColor(230, 230, 230);
  doc.rect(margin, y - 6, contentWidth, 8, 'F');
  doc.setFont(undefined, 'bold');
  doc.text("CORRECTIVE ACTION FORM", 105, y, null, null, "center");
  y += 10;

  // Meta Data
  doc.setFont(undefined, 'normal');
  doc.text(`Subject: ${template.subject}`, margin, y);
  doc.text(`Discussion Date: ${data.discussionDate}`, 105, y);
  y += 8;
  doc.text(`Program: ${data.program}`, margin, y);
  doc.text(`City/State/Store #: ${data.storeLocation}`, 105, y);
  y += 8;
  
  // Prior Notifications
  doc.text("Prior Notifications (if applicable):", margin, y);
  doc.text(`Date: ${data.priorDate || 'N/A'}`, 80, y);
  doc.text(`Subject: ${data.priorSubject || 'N/A'}`, 130, y);
  y += 12;

  // Section 1: Specific Details
  addText("SPECIFIC DETAILS OF CURRENT CONDUCT OR PERFORMANCE ISSUE:", 10, 'bold');
  doc.setFont(undefined, 'italic');
  doc.setFontSize(8);
  doc.text("Please document specific dates and type of infraction.", margin, y - 2);
  y += 4;
  addText(data.details, 10, 'normal');
  y += 5;

  // Section 2: Policy Expectations
  addText("POLICY EXPECTATIONS:", 10, 'bold');
  addText(template.policy, 10, 'normal');
  y += 5;

  // Section 3: Required Improvement
  addText("REQUIRED IMPROVEMENT:", 10, 'bold');
  doc.setFont(undefined, 'italic');
  doc.setFontSize(8);
  doc.text("Please include division specific expectations.", margin, y - 2);
  y += 4;
  addText(data.requiredImprovement, 10, 'normal');
  y += 5;

  // Section 4: Associate Comments
  addText("ASSOCIATE COMMENTS:", 10, 'bold');
  addText(data.associateComments || "No comments provided.", 10, 'normal');
  y += 5;

  // Disclaimer Block (Page Break logic simplistic for now, assuming 1 page fit or clean break)
  if (y > 220) { doc.addPage(); y = 20; }
  
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y, contentWidth, 40, 'F');
  y += 5;
  
  addText("ASSOCIATE ACKNOWLEDGMENT", 9, 'bold');
  const legalText = `By signing below, I acknowledge I have received and read the corrective action which is intended to remind me of important company policies and/or performance expectations and the consequences of my failure to satisfy them. I understand: I am expected to comply with Advantage Solutions Inc. and its subsidiaries ("the Company") policies and procedures and to satisfy all job-related expectations. I understand that my signing and submitting this document in an electronic fashion is the legal equivalent of having placed my handwritten signature on the submitted document.`;
  
  doc.setFontSize(7);
  doc.text(doc.splitTextToSize(legalText, 170), margin + 5, y);
  y += 40;

  // Signatures
  doc.setFont(undefined, 'bold');
  doc.setFontSize(10);
  
  // Supervisor
  doc.text("Supervisor Signature:", margin, y);
  if (data.supervisorSignature) {
    doc.addImage(data.supervisorSignature, 'PNG', margin, y + 2, 50, 15);
  }
  doc.text(`Date: ${data.discussionDate}`, margin, y + 20);

  // Associate
  doc.text("Associate Signature:", 110, y);
  if (data.associateSignature) {
    doc.addImage(data.associateSignature, 'PNG', 110, y + 2, 50, 15);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 110, y + 20);
  } else {
    doc.text("(Pending Signature)", 110, y + 10);
  }

  doc.save(`${data.associateName}_CAF.pdf`);
};

// --- COMPONENTS ---

// 1. Dashboard
const Dashboard = () => {
  const [cafs, setCafs] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "cafs"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCafs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsubscribe;
  }, []);

  return (
    <div style={styles.container}>
      <h2>Supervisor Dashboard</h2>
      <Link to="/create"><button style={styles.btn}>+ Create New CAF</button></Link>
      <hr />
      {cafs.map(caf => (
        <div key={caf.id} style={styles.card}>
          <h3>{caf.associateName} - {TEMPLATES[caf.templateKey]?.label}</h3>
          <p>Status: <strong style={{color: caf.status === 'Completed' ? 'green' : 'orange'}}>{caf.status}</strong></p>
          {caf.status === 'Completed' ? (
             <button style={styles.btn} onClick={() => generatePDF(caf)}>Download Completed PDF</button>
          ) : (
             <div>
               <p>Send this link to associate:</p>
               {/* Fixed Link Logic */}
               <code style={{background:'#eee', padding:'10px', display:'block', wordBreak:'break-all'}}>
                 {window.location.href.split('#')[0]}#/sign/{caf.id}
               </code>
             </div>
          )}
        </div>
      ))}
    </div>
  );
};

// 2. Create Form
const CreateCAF = () => {
  const navigate = useNavigate();
  const sigPad = useRef({});
  const [formData, setFormData] = useState({
    templateKey: 'attendance',
    associateName: '', associateId: '', supervisorName: '',
    discussionDate: new Date().toISOString().split('T')[0], 
    program: '', storeLocation: '',
    priorDate: '', priorSubject: '',
    details: '', requiredImprovement: ''
  });

  const handleChange = (e) => setFormData({...formData, [e.target.name]: e.target.value});

  const handleSubmit = async () => {
    if (sigPad.current.isEmpty()) return alert("Please sign the document");
    
    await addDoc(collection(db, "cafs"), {
      ...formData,
      supervisorSignature: sigPad.current.toDataURL(), // FIXED
      status: 'Pending Associate',
      associateComments: '',
      timestamp: new Date()
    });
    navigate('/');
  };

  return (
    <div style={styles.container}>
      <h2>Create Corrective Action Form</h2>
      <div style={styles.card}>
        <h3 style={styles.sectionHeader}>1. General Information</h3>
        
        <div style={styles.inputGroup}>
          <label style={styles.label}>Select Infraction Type</label>
          <select style={styles.input} name="templateKey" value={formData.templateKey} onChange={handleChange}>
            {Object.entries(TEMPLATES).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </div>

        <div style={{display:'flex', gap:'10px'}}>
          <div style={{flex:1}}>
            <label style={styles.label}>Associate Name</label>
            <input style={styles.input} name="associateName" onChange={handleChange} />
          </div>
          <div style={{flex:1}}>
             <label style={styles.label}>Associate ID</label>
             <input style={styles.input} name="associateId" onChange={handleChange} />
          </div>
        </div>

        <div style={styles.inputGroup}>
            <label style={styles.label}>Supervisor Name</label>
            <input style={styles.input} name="supervisorName" onChange={handleChange} />
        </div>

        <div style={styles.inputGroup}>
            <label style={styles.label}>Discussion Date</label>
            <input type="date" style={styles.input} name="discussionDate" value={formData.discussionDate} onChange={handleChange} />
        </div>

        <div style={{display:'flex', gap:'10px'}}>
          <div style={{flex:1}}>
            <label style={styles.label}>Program</label>
            <input style={styles.input} name="program" placeholder="e.g. SAS Retail" onChange={handleChange} />
          </div>
          <div style={{flex:1}}>
             <label style={styles.label}>City/State or Store #</label>
             <input style={styles.input} name="storeLocation" onChange={handleChange} />
          </div>
        </div>

        <h3 style={styles.sectionHeader}>2. Prior Notifications (Optional)</h3>
        <div style={{display:'flex', gap:'10px'}}>
          <div style={{flex:1}}>
            <label style={styles.label}>Date of Prior</label>
            <input type="date" style={styles.input} name="priorDate" onChange={handleChange} />
          </div>
          <div style={{flex:1}}>
             <label style={styles.label}>Subject of Prior</label>
             <input style={styles.input} name="priorSubject" onChange={handleChange} />
          </div>
        </div>

        <h3 style={styles.sectionHeader}>3. Details & Expectations</h3>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Specific Details of Conduct</label>
          <textarea style={styles.textarea} name="details" placeholder="Document specific dates and type of infraction..." onChange={handleChange} />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Required Improvement</label>
          <textarea style={styles.textarea} name="requiredImprovement" placeholder="Include division specific expectations..." onChange={handleChange} />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Supervisor Signature</label>
          <SignatureCanvas penColor='black' canvasProps={{className: 'sigPad', style: styles.sigPad}} ref={sigPad} />
          <button style={{marginTop:'5px', padding:'5px'}} onClick={() => sigPad.current.clear()}>Clear Signature</button>
        </div>

      </div>
      <button style={styles.btn} onClick={handleSubmit}>Save & Generate Link</button>
    </div>
  );
};

// 3. Associate View
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

    const updatedData = {
      ...data,
      associateComments: comments,
      associateSignature: sigPad.current.toDataURL(), // FIXED
      status: 'Completed'
    };

    await updateDoc(doc(db, "cafs", id), {
      associateComments: comments,
      associateSignature: updatedData.associateSignature,
      status: 'Completed'
    });

    generatePDF(updatedData);
    alert("Signed successfully! The document has been downloaded.");
    setData(updatedData);
  };

  if (!data) return <div>Loading form...</div>;
  if (data.status === 'Completed') return <div style={styles.container}><h2>Document Completed</h2><p>This document has already been signed.</p></div>;

  return (
    <div style={styles.container}>
      <h2>Review Corrective Action Form</h2>
      <div style={styles.card}>
        <p><strong>Associate:</strong> {data.associateName}</p>
        <p><strong>Subject:</strong> {TEMPLATES[data.templateKey]?.label}</p>
        
        <h4 style={{borderBottom:'1px solid #ccc'}}>Details</h4>
        <p>{data.details}</p>

        <h4 style={{borderBottom:'1px solid #ccc'}}>Required Improvement</h4>
        <p>{data.requiredImprovement}</p>

        <h4 style={{borderBottom:'1px solid #ccc'}}>Policy Expectations</h4>
        <p style={{fontSize:'0.9em'}}>{TEMPLATES[data.templateKey]?.policy}</p>
      </div>

      <div style={styles.card}>
        <label style={styles.label}>Associate Comments</label>
        <textarea style={styles.textarea} value={comments} onChange={(e) => setComments(e.target.value)} />

        <div style={{backgroundColor:'#f9f9f9', padding:'10px', fontSize:'0.8em', margin:'15px 0'}}>
            <strong>Associate Acknowledgment:</strong><br/>
            By signing below, I acknowledge I have received and read the corrective action... 
            (Full legal text will appear on PDF)
        </div>

        <label style={styles.label}>Associate Signature</label>
        <SignatureCanvas penColor='black' canvasProps={{className: 'sigPad', style: styles.sigPad}} ref={sigPad} />
        <button style={{marginTop:'5px', padding:'5px'}} onClick={() => sigPad.current.clear()}>Clear Signature</button>
      </div>

      <button style={styles.btn} onClick={handleSign}>Sign & Finish</button>
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/create" element={<CreateCAF />} />
        <Route path="/sign/:id" element={<AssociateSign />} />
      </Routes>
    </Router>
  );
}