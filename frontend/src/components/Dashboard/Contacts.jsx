import { useState, useEffect } from 'react';
import { FiPlus, FiEdit, FiTrash2, FiPhone, FiMail, FiCheckCircle, FiAlertCircle, FiUser } from 'react-icons/fi';
import api from '../../services/api';
import './Contacts.css';
import '../shared/Modal.css';

function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [contactToDelete, setContactToDelete] = useState(null);
  const [alertMessage, setAlertMessage] = useState({ type: '', message: '' });
  const [editingContact, setEditingContact] = useState(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    number: '',
    note: ''
  });

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/contact/get-all');
      if (res.data.status) {
        setContacts(res.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load contacts:', error);
    }
    setLoading(false);
  };

  const showAlert = (type, message) => {
    setAlertMessage({ type, message });
    setShowAlertModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Ensure phone number has country code prefix
    let phoneNumber = formData.number.trim();

    // If it doesn't start with +, add it
    if (!phoneNumber.startsWith('+')) {
      phoneNumber = `+${phoneNumber}`;
    }

    const dataToSubmit = {
      ...formData,
      number: phoneNumber
    };

    try {
      if (editingContact) {
        const res = await api.post('/contact/update', {
          ...dataToSubmit,
          contact_id: editingContact._id
        });
        if (res.data.status) {
          showAlert('success', '✨ Contact updated successfully!');
          loadContacts();
          closeModal();
          window.dispatchEvent(new CustomEvent('contactSaved'));
        }
      } else {
        const res = await api.post('/contact/create', dataToSubmit);
        if (res.data.status) {
          showAlert('success', '✨ Contact added successfully!');
          loadContacts();
          closeModal();
          window.dispatchEvent(new CustomEvent('contactSaved'));
        }
      }
    } catch (error) {
      console.error('Failed to save contact:', error);
      const errorMsg = error.response?.data?.message || 'Failed to save contact';
      showAlert('error', errorMsg);
    }
  };

  const confirmDelete = (contact) => {
    setContactToDelete(contact);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!contactToDelete) return;

    try {
      const res = await api.post('/contact/delete', { contact_id: contactToDelete._id });
      if (res.data.status) {
        showAlert('success', 'Contact deleted successfully');
        loadContacts();
        setShowDeleteConfirm(false);
        // Dispatch custom event to notify Dashboard and other components
        window.dispatchEvent(new CustomEvent('contactDeleted', { 
          detail: { phoneNumber: contactToDelete.number } 
        }));
        setContactToDelete(null);
      }
    } catch (error) {
      console.error('Failed to delete contact:', error);
      showAlert('error', 'Failed to delete contact');
    }
  };

  const openModal = (contact = null) => {
    if (contact) {
      setEditingContact(contact);
      setFormData({
        first_name: contact.first_name || '',
        last_name: contact.last_name || '',
        number: contact.number || '',
        note: contact.note || ''
      });
    } else {
      setEditingContact(null);
      setFormData({ first_name: '', last_name: '', number: '', note: '' });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingContact(null);
    setFormData({ first_name: '', last_name: '', number: '', note: '' });
  };

  const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return cleaned.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '+$1 ($2) $3-$4');
    }
    return phone;
  };

  const getInitials = (contact) => {
    const first = contact.first_name?.charAt(0) || '';
    const last = contact.last_name?.charAt(0) || '';
    return (first + last).toUpperCase() || '?';
  };

  return (
    <div className="contacts-container">
      <div className="contacts-header">
        <div>
          <h2>📇 Contacts</h2>
          <p className="header-subtitle">{contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'}</p>
        </div>
        <button onClick={() => openModal()} className="add-contact-btn">
          <FiPlus /> Add Contact
        </button>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading contacts...</p>
        </div>
      ) : contacts.length === 0 ? (
        <div className="empty-contacts">
          <div className="empty-icon">
            <FiUser />
          </div>
          <h3>No contacts yet</h3>
          <p>Add your first contact to start messaging</p>
          <button onClick={() => openModal()} className="primary-btn">
            <FiPlus /> Add Your First Contact
          </button>
        </div>
      ) : (
        <div className="contacts-grid">
          {contacts.map((contact) => (
            <div key={contact._id} className="contact-card">
              <div className="contact-avatar">
                {getInitials(contact)}
              </div>
              <div className="contact-info">
                <h3>{contact.first_name} {contact.last_name}</h3>
                <div className="contact-details">
                  <div className="contact-detail">
                    <FiPhone size={14} />
                    <span>{formatPhoneNumber(contact.number)}</span>
                  </div>
                  {contact.note && (
                    <div className="contact-detail note">
                      <span>{contact.note}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="contact-actions">
                <button onClick={() => openModal(contact)} className="edit-btn" title="Edit">
                  <FiEdit />
                </button>
                <button onClick={() => confirmDelete(contact)} className="contact-delete-btn" title="Delete">
                  <FiTrash2 />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Contact Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{editingContact ? '✏️ Edit Contact' : '➕ Add Contact'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>First Name *</label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                    placeholder="John"
                  />
                </div>
                <div className="form-group">
                  <label>Last Name</label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    placeholder="Doe"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Phone Number *</label>
                <input
                  type="tel"
                  value={formData.number}
                  onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  required
                  placeholder="+1234567890, +44234567890, or 1234567890"
                />
                <small>Include country code (e.g., +1 for US, +44 for UK, +91 for India)</small>
              </div>
              <div className="form-group">
                <label>Note (optional)</label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  placeholder="Add a note about this contact..."
                  rows="3"
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={closeModal} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" className="confirm-btn">
                  {editingContact ? 'Update' : 'Add'} Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content alert-modal" onClick={(e) => e.stopPropagation()}>
            <div className="icon error">
              <FiAlertCircle />
            </div>
            <h3>Delete Contact?</h3>
            <p>Are you sure you want to delete <strong>{contactToDelete?.first_name} {contactToDelete?.last_name}</strong>?</p>
            <p className="warning-text">This action cannot be undone.</p>
            <div className="modal-actions">
              <button onClick={() => setShowDeleteConfirm(false)} className="cancel-btn">
                Cancel
              </button>
              <button onClick={handleDelete} className="delete-confirm-btn">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      {showAlertModal && (
        <div className="modal-overlay" onClick={() => setShowAlertModal(false)}>
          <div className={`modal-content alert-modal ${alertMessage.type}`} onClick={(e) => e.stopPropagation()}>
            <div className="icon">
              {alertMessage.type === 'success' ? <FiCheckCircle /> : <FiAlertCircle />}
            </div>
            <h3>{alertMessage.type === 'success' ? 'Success' : 'Error'}</h3>
            <p>{alertMessage.message}</p>
            <div className="modal-actions">
              <button onClick={() => setShowAlertModal(false)} className="confirm-btn">
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Contacts;
