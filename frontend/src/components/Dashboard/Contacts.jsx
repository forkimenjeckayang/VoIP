import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiPhone, FiMail } from 'react-icons/fi';
import api from '../../services/api';
import './Contacts.css';

function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    email: ''
  });

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/contact/get-all');
      if (res.data.status === 'true') {
        setContacts(res.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load contacts:', error);
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingContact) {
        const res = await api.post('/contact/update', {
          ...formData,
          id: editingContact._id
        });
        if (res.data.status === 'true') {
          loadContacts();
          closeModal();
        }
      } else {
        const res = await api.post('/contact/create', formData);
        if (res.data.status === 'true') {
          loadContacts();
          closeModal();
        }
      }
    } catch (error) {
      console.error('Failed to save contact:', error);
      alert('Failed to save contact');
    }
  };

  const handleDelete = async (contactId) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    
    try {
      const res = await api.post('/contact/delete', { id: contactId });
      if (res.data.status === 'true') {
        loadContacts();
      }
    } catch (error) {
      console.error('Failed to delete contact:', error);
      alert('Failed to delete contact');
    }
  };

  const openModal = (contact = null) => {
    if (contact) {
      setEditingContact(contact);
      setFormData({
        name: contact.name || '',
        phoneNumber: contact.phoneNumber || '',
        email: contact.email || ''
      });
    } else {
      setEditingContact(null);
      setFormData({ name: '', phoneNumber: '', email: '' });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingContact(null);
    setFormData({ name: '', phoneNumber: '', email: '' });
  };

  const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    return phone.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '+$1 ($2) $3-$4');
  };

  return (
    <div className="contacts-container">
      <div className="contacts-header">
        <h2>Contacts</h2>
        <button onClick={() => openModal()} className="add-contact-btn">
          <FiPlus /> Add Contact
        </button>
      </div>

      {loading ? (
        <div className="loading-state">Loading contacts...</div>
      ) : contacts.length === 0 ? (
        <div className="empty-contacts">
          <FiPhone size={48} />
          <p>No contacts yet</p>
          <button onClick={() => openModal()}>Add your first contact</button>
        </div>
      ) : (
        <div className="contacts-grid">
          {contacts.map((contact) => (
            <div key={contact._id} className="contact-card">
              <div className="contact-avatar">
                {contact.name?.charAt(0).toUpperCase() || 'C'}
              </div>
              <div className="contact-info">
                <h3>{contact.name}</h3>
                <div className="contact-details">
                  <div className="contact-detail">
                    <FiPhone size={14} />
                    <span>{formatPhoneNumber(contact.phoneNumber)}</span>
                  </div>
                  {contact.email && (
                    <div className="contact-detail">
                      <FiMail size={14} />
                      <span>{contact.email}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="contact-actions">
                <button onClick={() => openModal(contact)} title="Edit">
                  <FiEdit2 />
                </button>
                <button onClick={() => handleDelete(contact._id)} title="Delete">
                  <FiTrash2 />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{editingContact ? 'Edit Contact' : 'Add Contact'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  required
                  placeholder="+1234567890"
                />
              </div>
              <div className="form-group">
                <label>Email (optional)</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={closeModal} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit">
                  {editingContact ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Contacts;
