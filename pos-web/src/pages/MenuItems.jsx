import { useState, useEffect, useRef } from "react";
import api from "../api";
import "../styles/menu-management-styles/index.css";

export default function MenuItems() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customizationGroups, setCustomizationGroups] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    category_id: "",
    station: "barista",
    status: "available",
    image: "",
    is_customizable: false,
    selected_groups: []
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [itemsRes, categoriesRes, groupsRes] = await Promise.all([
        api.get("/menu/items"),
        api.get("/menu/categories"),
        api.get("/customizations/groups")
      ]);
      setItems(itemsRes.data.items || itemsRes.data || []);
      setCategories(categoriesRes.data.categories || categoriesRes.data || []);
      setCustomizationGroups(groupsRes.data.groups || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setFormData({ ...formData, image: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        price: parseFloat(formData.price),
        category_id: parseInt(formData.category_id),
        station: formData.station,
        status: formData.status,
        image: formData.image || null,
        is_customizable: formData.is_customizable
      };
      
      let itemId;
      if (editingItem) {
        await api.put(`/menu/items/${editingItem.item_id}`, payload);
        itemId = editingItem.item_id;
      } else {
        const response = await api.post("/menu/items", payload);
        itemId = response.data.item_id;
      }

      // Update customization group links if item is customizable
      if (formData.is_customizable && itemId) {
        await api.put(`/customizations/item/${itemId}/groups`, {
          group_ids: formData.selected_groups
        });
      } else if (!formData.is_customizable && itemId) {
        // Clear customization links if not customizable
        await api.put(`/customizations/item/${itemId}/groups`, {
          group_ids: []
        });
      }

      await fetchData();
      closeModal();
    } catch (error) {
      console.error("Error saving item:", error);
      alert("Failed to save item. Please check all fields are filled correctly.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeleteModal = (item) => {
    setDeleteTarget(item);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    try {
      await api.delete(`/menu/items/${deleteTarget.item_id}`);
      await fetchData();
      closeDeleteModal();
    } catch (error) {
      console.error("Error deleting item:", error);
      alert("Failed to delete item");
    } finally {
      setIsDeleting(false);
    }
  };

  const openEditModal = async (item) => {
    setEditingItem(item);
    
    // Fetch linked customization groups for this item
    let linkedGroups = [];
    try {
      const groupsRes = await api.get(`/customizations/item/${item.item_id}/groups`);
      linkedGroups = (groupsRes.data.groups || []).map(g => g.group_id);
    } catch (error) {
      console.error("Error fetching item groups:", error);
    }

    setFormData({
      name: item.name,
      description: item.description || "",
      price: item.price.toString(),
      category_id: item.category_id.toString(),
      station: item.station || "barista",
      status: item.status || "available",
      image: item.image || "",
      is_customizable: item.is_customizable || false,
      selected_groups: linkedGroups
    });
    setImagePreview(item.image || null);
    setShowModal(true);
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      description: "",
      price: "",
      category_id: "",
      station: "barista",
      status: "available",
      image: "",
      is_customizable: false,
      selected_groups: []
    });
    setImagePreview(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setFormData({
      name: "",
      description: "",
      price: "",
      category_id: "",
      station: "barista",
      status: "available",
      image: "",
      is_customizable: false,
      selected_groups: []
    });
  };

  const handleGroupToggle = (groupId) => {
    const currentGroups = formData.selected_groups || [];
    if (currentGroups.includes(groupId)) {
      setFormData({
        ...formData,
        selected_groups: currentGroups.filter(id => id !== groupId)
      });
    } else {
      setFormData({
        ...formData,
        selected_groups: [...currentGroups, groupId]
      });
    }
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find((c) => c.category_id === categoryId);
    return category ? category.name : "Unknown";
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !filterCategory || item.category_id === parseInt(filterCategory);
    const matchesStatus = !filterStatus || item.status === filterStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="main-content">
      <div className="page-header-section">
        <div className="page-title-group">
          <h1 className="page-title">Add Item</h1>
          <p className="page-subtitle">Manage your menu items and pricing</p>
        </div>
      </div>

      <div className="toolbar-section">
        <div className="toolbar-left">
          <div className="search-box">
            <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="filter-select"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.category_id} value={cat.category_id}>
                {cat.name}
              </option>
            ))}
          </select>
          <select
            className="filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="available">Available</option>
            <option value="sold_out">Sold Out</option>
          </select>
        </div>
        <div className="toolbar-right">
          <button className="btn-primary-action" onClick={openAddModal}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add Item
          </button>
        </div>
      </div>

      <div className="table-card">
        {loading ? (
          <div className="loading-state">Loading items...</div>
        ) : filteredItems.length === 0 ? (
          <div className="empty-state">
            <p>No items found. Add your first menu item!</p>
          </div>
        ) : (
          <div className="table-scroll-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Item Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Station</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.item_id}>
                  <td>
                    <div className="item-image-cell">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="table-image" />
                      ) : (
                        <div className="no-image-placeholder">No Image</div>
                      )}
                    </div>
                  </td>
                  <td><span className="item-name-text">{item.name}</span></td>
                  <td>{getCategoryName(item.category_id)}</td>
                  <td className="price-cell">P{parseFloat(item.price).toFixed(2)}</td>
                  <td>
                    <span className={`station-badge station-${item.station}`}>
                      {item.station}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${item.status === "available" ? "status-available" : "status-soldout"}`}>
                      {item.status === "available" ? "Available" : "Sold Out"}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn-action btn-edit" onClick={() => openEditModal(item)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        Edit
                      </button>
                      <button className="btn-action btn-delete" onClick={() => openDeleteModal(item)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Add/Edit Item Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content modal-large no-scroll" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px', width: '90%' }}>
            <div className="modal-header" style={{ flexShrink: 0 }}>
              <h3 className="modal-title">{editingItem ? "Edit Item" : "Add New Item"}</h3>
              <button type="button" className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto', padding: '20px', flex: 1, textAlign: 'left' }}>
              <form id="itemForm" onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Item Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter item name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-select"
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map((cat) => (
                      <option key={cat.category_id} value={cat.category_id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Price (PHP)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="form-input"
                    value={formData.price}
                    onChange={(e) => { if (e.target.value === '' || /^\d*\.?\d{0,2}$/.test(e.target.value)) setFormData({ ...formData, price: e.target.value }); }}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Station</label>
                  <select
                    className="form-select"
                    value={formData.station}
                    onChange={(e) => setFormData({ ...formData, station: e.target.value })}
                    required
                  >
                    <option value="barista">Barista</option>
                    <option value="kitchen">Kitchen</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Description (Optional)</label>
                <textarea
                  className="form-textarea"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter item description"
                  rows={3}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Item Image (Optional)</label>
                  <div className="image-upload-box">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleImageChange}
                      className="file-input-hidden"
                      id="image-upload"
                    />
                    {imagePreview ? (
                      <div className="image-preview-box">
                        <img src={imagePreview} alt="Preview" />
                        <button 
                          type="button" 
                          className="change-image-btn"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Change Image
                        </button>
                        <button 
                          type="button" 
                          className="remove-image-btn"
                          onClick={() => {
                            setImagePreview(null);
                            setFormData({ ...formData, image: "" });
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <label htmlFor="image-upload" className="upload-placeholder">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="17 8 12 3 7 8"></polyline>
                          <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                        <span>Choose Image</span>
                      </label>
                    )}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="available">Available</option>
                    <option value="sold_out">Sold Out</option>
                  </select>
                </div>
              </div>

              {/* Customization Section */}
              <div className="customization-form-section">
                <div className="form-group checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.is_customizable}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        is_customizable: e.target.checked,
                        selected_groups: e.target.checked ? formData.selected_groups : []
                      })}
                    />
                    <span>This item is customizable</span>
                    <small className="form-hint-inline">(drinks with size, temperature, add-ons, etc.)</small>
                  </label>
                </div>

                {formData.is_customizable && (
                  <div className="customization-groups-selection">
                    <label className="form-label">Select Customization Groups</label>
                    <small className="form-hint">Choose which customization options apply to this item</small>
                    
                    {customizationGroups.filter(g => g.status === 'active').length > 0 && (
                      <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #eee' }}>
                        <label className="checkbox-label" style={{ fontWeight: '600', color: '#5d4037', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={
                              customizationGroups.filter(g => g.status === 'active').length > 0 &&
                              formData.selected_groups.length === customizationGroups.filter(g => g.status === 'active').length
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  selected_groups: customizationGroups.filter(g => g.status === 'active').map(g => g.group_id)
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  selected_groups: []
                                });
                              }
                            }}
                          />
                          <span>Select All Groups</span>
                        </label>
                      </div>
                    )}

                    <div className="groups-checkbox-list">
                      {customizationGroups.filter(g => g.status === 'active').map((group) => (
                        <label key={group.group_id} className="group-checkbox-item">
                          <input
                            type="checkbox"
                            checked={formData.selected_groups.includes(group.group_id)}
                            onChange={() => handleGroupToggle(group.group_id)}
                          />
                          <span className="group-checkbox-label">
                            <strong>{group.name}</strong>
                            <small>{group.options?.length || 0} options</small>
                          </span>
                        </label>
                      ))}
                      {customizationGroups.filter(g => g.status === 'active').length === 0 && (
                        <p className="no-groups-hint">No customization groups available. Create groups in Customizations page first.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              </form>
            </div>
            <div className="modal-footer" style={{ padding: '16px 20px', display: 'flex', gap: '10px', borderTop: '1px solid #eee', background: '#fafafa', borderRadius: '0 0 16px 16px', flexShrink: 0 }}>
              <button type="button" className="btn-cancel" onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" form="itemForm" className="btn-confirm" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : (editingItem ? "Save Changes" : "Add Item")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteTarget && (
        <div className="modal-overlay" onClick={closeDeleteModal}>
          <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: '#333' }}>Delete Item</h3>
              <button className="modal-close" onClick={closeDeleteModal} style={{ color: '#666' }}>×</button>
            </div>
            <div className="delete-modal-body">
              <div className="delete-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef5350" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
              </div>
              <p className="delete-message">
                Are you sure you want to delete <strong>"{deleteTarget.name}"</strong>?
              </p>
              <p className="delete-warning">This action cannot be undone.</p>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={closeDeleteModal}>
                Cancel
              </button>
              <button type="button" className="btn-danger" onClick={confirmDelete} disabled={isDeleting}>
                {isDeleting ? "Deleting..." : "Delete Item"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
