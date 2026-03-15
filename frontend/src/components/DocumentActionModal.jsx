import { useNavigate } from 'react-router-dom';

export default function DocumentActionModal({ type, id, number, onClose }) {
  const navigate = useNavigate();

  const handleView = () => {
    onClose();
    if (type === 'sale') navigate(`/sales/${id}`);
    else if (type === 'purchase') navigate(`/purchases/${id}`);
    else if (type === 'payment') navigate('/payments');
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h3 className="modal-title">Document Created</h3>
        </div>
        <div className="modal-body" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
          <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{number}</p>
          <p style={{ color: 'var(--text-muted)' }}>What would you like to do?</p>
        </div>
        <div className="modal-footer" style={{ justifyContent: 'center', gap: 12 }}>
          <button className="btn btn-primary" onClick={handleView}>View & Print</button>
          <button className="btn btn-secondary" onClick={onClose}>Skip</button>
        </div>
      </div>
    </div>
  );
}
