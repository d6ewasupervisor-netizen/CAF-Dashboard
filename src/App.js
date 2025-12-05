import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { collection, addDoc, doc, getDoc, updateDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import SignatureCanvas from 'react-signature-canvas';
import jsPDF from 'jspdf';
import { TEMPLATES } from './templates';

// --- STYLES (Simple inline styles for the prototype) ---
const styles = {
  container: { maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'Arial, sans-serif' },
  card: { border: '1px solid #ccc', borderRadius: '8px', padding: '20px', marginBottom: '20px', backgroundColor: '#fff' },
  input: { width: '100%', padding: '10px', marginBottom: '15px', border: '1px solid #ddd', borderRadius: '4px' },
  btn: { padding: '10px 20px', backgroundColor: '#0056b3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '10px' },
  label: { display: 'block', fontWeight: 'bold', marginBottom: '5px' },
  sigPad: { border: '1px solid #000', width: '100%', height: '150px', backgroundColor: '#f0f0f0' }
};

// --- PDF GENERATOR FUNCTION ---
const generatePDF = (data) => {
  const doc = new jsPDF();
  const template = TEMPLATES[data.templateKey];
  
  // Header
  doc.setFontSize(10);
  doc.text(`Associate Name: ${data.associateName}`, 15, 20); // [cite: 1]
  doc.text(`Associate ID#: ${data.associateId}`, 15, 25); // [cite: 2]
  doc.text(`Supervisor Name: ${data.supervisorName}`, 15, 30); // [cite: 3]
  doc.text(`Discussion Date: ${data.discussionDate}`, 150, 20); // [cite: 7]
  
  // Title
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text("CORRECTIVE ACTION FORM", 105, 45, null, null, "center"); // [cite: 5]
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`Subject: ${template.subject}`, 105, 52, null, null, "center"); // [cite: 4]
  
  // Details
  doc.setFont(undefined, 'bold');
  doc.text("Specific Details of Conduct:", 15, 65); // [cite: 13]
  doc.setFont(undefined, 'normal');
  const details = doc.splitTextToSize(data.details, 180);
  doc.text(details, 15, 72);

  // Policy Expectations
  let yPos = 72 + (details.length * 5) + 10;
  doc.setFont(undefined, 'bold');
  doc.text("Policy Expectations:", 15, yPos); // [cite: 17]
  doc.setFont(undefined, 'normal');
  const policy = doc.splitTextToSize(template.policy, 180);
  doc.text(policy, 15, yPos + 7);

  // Associate Comments
  yPos = yPos + (policy.length * 5) + 20;
  doc.setFont(undefined, 'bold');
  doc.text("Associate Comments:", 15, yPos); // 
  doc.setFont(undefined, 'normal');
  const comments = doc.splitTextToSize(data.associateComments || "No comments provided.", 180);
  doc.text(comments, 15, yPos + 7);

  // Signatures
  yPos = yPos + (comments.length * 5) + 30;
  
  // Supervisor Sig
  doc.text("Supervisor Signature:", 15, yPos); // 
  if (data.supervisorSignature) {
    doc.addImage(data.supervisorSignature, 'PNG', 15, yPos + 2, 60, 20);
  }
  
  // Associate Sig
  doc.text("Associate Signature:", 110, yPos); // 
  if (data.associateSignature) {
    doc.addImage(data.associateSignature, 'PNG', 110, yPos + 2, 60, 20);
  } else {
    doc.text("(Pending Signature)", 110, yPos + 15);
  }

  // Footer Disclaimer
  doc.setFontSize(8);
  doc.text("By signing, I acknowledge I have received and read this corrective action... [cite: 28]", 15, 280);
  
  doc.save(`${data.associateName}_CAF.pdf`);
};

// --- COMPONENTS ---

// 1. Dashboard (Supervisor View)
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
          <p>Status: <strong>{caf.status}</strong></p>
          {caf.status === 'Completed' ? (
             <button style={styles.btn} onClick={() => generatePDF(caf)}>Download Completed PDF</button>
          ) : (
             <p>Send this link to associate: <br/> 
                <code style={{background:'#eee', padding:'5px'}}>{window.location.origin}/sign/{caf.id}</code>
             </p>
          )}
        </div>
      ))}
    </div>
  );
};

// 2. Create Form (Supervisor Input)
const CreateCAF = () => {
  const navigate = useNavigate();
  const sigPad = useRef({});
  const [formData, setFormData] = useState({
    templateKey: 'appearance',
    associateName: '', associateId: '', supervisorName: '',
    discussionDate: '', program: '', cityState: '',
    details: '' // [cite: 13]
  });

  const handleSubmit = async () => {
    if (sigPad.current.isEmpty()) return alert("Please sign the document");
    
    await addDoc(collection(db, "cafs"), {
      ...formData,
      supervisorSignature: sigPad.current.getTrimmedCanvas().toDataURL('image/png'),
      status: 'Pending Associate',
      associateComments: '', // Initially empty
      timestamp: new Date()
    });
    navigate('/');
  };

  return (
    <div style={styles.container}>
      <h2>Create Corrective Action Form</h2>
      <div style={styles.card}>
        <label style={styles.label}>Infraction Type</label>
        <select style={styles.input} onChange={e => setFormData({...formData, templateKey: e.target.value})}>
          {Object.entries(TEMPLATES).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>

        <label style={styles.label}>Associate Name [cite: 1]</label>
        <input style={styles.input} onChange={e => setFormData({...formData, associateName: e.target.value})} />

        <label style={styles.label}>Associate ID [cite: 2]</label>
        <input style={styles.input} onChange={e => setFormData({...formData, associateId: e.target.value})} />

        <label style={styles.label}>Specific Details of Conduct [cite: 13]</label>
        <textarea style={{...styles.input, height: '100px'}} onChange={e => setFormData({...formData, details: e.target.value})} />

        <label style={styles.label}>Supervisor Signature </label>
        <SignatureCanvas penColor='black' canvasProps={{className: 'sigPad', style: styles.sigPad}} ref={sigPad} />
        <button style={{marginTop:'10px'}} onClick={() => sigPad.current.clear()}>Clear</button>
      </div>
      <button style={styles.btn} onClick={handleSubmit}>Save & Generate Link</button>
    </div>
  );
};

// 3. Associate View (Add Comments & Sign)
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
      associateComments: comments, // 
      associateSignature: sigPad.current.getTrimmedCanvas().toDataURL('image/png'),
      status: 'Completed'
    };

    await updateDoc(doc(db, "cafs", id), {
      associateComments: comments,
      associateSignature: updatedData.associateSignature,
      status: 'Completed'
    });

    // Generate PDF for the associate immediately
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
        <p><strong>Issue:</strong> {TEMPLATES[data.templateKey].label}</p>
        <p><strong>Details:</strong> {data.details}</p>
        <p><strong>Supervisor Signature:</strong> (Signed)</p>
      </div>

      <div style={styles.card}>
        <label style={styles.label}>Associate Comments [cite: 25, 69, 111]</label>
        <p style={{fontSize: '0.9em', color: '#666'}}>Please enter any comments regarding this action here.</p>
        <textarea 
          style={{...styles.input, height: '100px'}} 
          value={comments}
          onChange={(e) => setComments(e.target.value)}
        />

        <label style={styles.label}>Associate Signature </label>
        <p style={{fontSize: '0.9em', color: '#666'}}>By signing, I acknowledge I have received and read this corrective action. [cite: 28]</p>
        <SignatureCanvas penColor='black' canvasProps={{className: 'sigPad', style: styles.sigPad}} ref={sigPad} />
        <button style={{marginTop:'10px'}} onClick={() => sigPad.current.clear()}>Clear</button>
      </div>

      <button style={styles.btn} onClick={handleSign}>Sign & Finish</button>
    </div>
  );
};

// Main Router
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