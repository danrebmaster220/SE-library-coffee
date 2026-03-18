import { useState, useEffect } from "react";
import api from "../api";
import "../styles/menu-management-styles/index.css";

export default function Customizations() {
  const [groups, setGroups] = useState([]);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showOptionModal, setShowOptionModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteType, setDeleteType] = useState("");
  const [editingGroup, setEditingGroup] = useState(null);
  const [editingOption, setEditingOption] = useState(null);
  const [currentGroupId, setCurrentGroupId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const [groupFormData, setGroupFormData] = useState({
    name: "",
    display_order: 0,
    selection_type: "single",
    input_type: "choice",
    is_required: false,
    status: "active",
    unit_label: ""
  });

  const [optionFormData, setOptionFormData] = useState({
    group_id: null,
    name: "",
    price: 0,
    price_per_unit: 0,
    max_quantity: 1,
    display_order: 0,
    status: "available"
  });

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const response = await api.get("/customizations/groups");
      setGroups(response.data.groups || []);
    } catch (error) {
      console.error("Error fetching customization groups:", error);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // GROUP HANDLERS
  // ==========================================

  const handleGroupSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...groupFormData,
        display_order: parseInt(groupFormData.display_order) || 0
      };

      if (editingGroup) {
        await api.put(`/customizations/groups/${editingGroup.group_id}`, payload);
      } else {
        await api.post("/customizations/groups", payload);
      }
      await fetchGroups();
      closeGroupModal();
    } catch (error) {
      console.error("Error saving group:", error);
      alert("Failed to save customization group");
    }
  };

  const openAddGroupModal = () => {
    setEditingGroup(null);
    setGroupFormData({
      name: "",
      display_order: groups.length,
      selection_type: "single",
      input_type: "choice",
      is_required: false,
      status: "active",
      unit_label: ""
    });
    setShowGroupModal(true);
  };

  const openEditGroupModal = (group) => {
    setEditingGroup(group);
    setGroupFormData({
      name: group.name,
      display_order: group.display_order,
      selection_type: group.selection_type,
      input_type: group.input_type,
      is_required: group.is_required,
      status: group.status,
      unit_label: group.unit_label || ""
    });
    setShowGroupModal(true);
  };

  const closeGroupModal = () => {
    setShowGroupModal(false);
    setEditingGroup(null);
    setGroupFormData({
      name: "",
      display_order: 0,
      selection_type: "single",
      input_type: "choice",
      is_required: false,
      status: "active",
      unit_label: ""
    });
  };

  // ==========================================
  // OPTION HANDLERS
  // ==========================================

  const handleOptionSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...optionFormData,
        group_id: currentGroupId,
        price: parseFloat(optionFormData.price) || 0,
        price_per_unit: parseFloat(optionFormData.price_per_unit) || 0,
        max_quantity: parseInt(optionFormData.max_quantity) || 1,
        display_order: parseInt(optionFormData.display_order) || 0
      };

      if (editingOption) {
        await api.put(`/customizations/options/${editingOption.option_id}`, payload);
      } else {
        await api.post("/customizations/options", payload);
      }
      await fetchGroups();
      closeOptionModal();
    } catch (error) {
      console.error("Error saving option:", error);
      alert("Failed to save customization option");
    }
  };

  const openAddOptionModal = (groupId) => {
    setCurrentGroupId(groupId);
    setEditingOption(null);
    const group = groups.find(g => g.group_id === groupId);
    setOptionFormData({
      group_id: groupId,
      name: "",
      price: 0,
      price_per_unit: 0,
      max_quantity: 1,
      display_order: group?.options?.length || 0,
      status: "available"
    });
    setShowOptionModal(true);
  };

  const openEditOptionModal = (option, groupId) => {
    setCurrentGroupId(groupId);
    setEditingOption(option);
    setOptionFormData({
      group_id: groupId,
      name: option.name,
      price: option.price,
      price_per_unit: option.price_per_unit,
      max_quantity: option.max_quantity,
      display_order: option.display_order,
      status: option.status
    });
    setShowOptionModal(true);
  };

  const closeOptionModal = () => {
    setShowOptionModal(false);
    setEditingOption(null);
    setCurrentGroupId(null);
    setOptionFormData({
      group_id: null,
      name: "",
      price: 0,
      price_per_unit: 0,
      max_quantity: 1,
      display_order: 0,
      status: "available"
    });
  };

  // ==========================================
  // DELETE HANDLERS
  // ==========================================

  const openDeleteModal = (target, type) => {
    setDeleteTarget(target);
    setDeleteType(type);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDeleteTarget(null);
    setDeleteType("");
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteType === "group") {
        await api.delete(`/customizations/groups/${deleteTarget.group_id}`);
      } else if (deleteType === "option") {
        await api.delete(`/customizations/options/${deleteTarget.option_id}`);
      }
      await fetchGroups();
      closeDeleteModal();
    } catch (error) {
      console.error("Error deleting:", error);
      alert(`Failed to delete ${deleteType}`);
    }
  };

  const toggleGroupExpand = (groupId) => {
    setExpandedGroup(expandedGroup === groupId ? null : groupId);
  };

  const filteredGroups = groups.filter((group) => {
    const matchesSearch = group.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !filterStatus || group.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getSelectionTypeLabel = (type) => {
    switch (type) {
      case "single": return "Single Select";
      case "multiple": return "Multiple Select";
      default: return type;
    }
  };

  const getInputTypeLabel = (type) => {
    switch (type) {
      case "choice": return "Choice Selection";
      case "quantity": return "Quantity Input";
      default: return type;
    }
  };

  return (
    <div className="main-content">
      <div className="page-header-section">
        <div className="page-title-group">
          <h1 className="page-title">Customizations</h1>
          <p className="page-subtitle">Manage drink customization groups and options</p>
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
              placeholder="Search groups..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="toolbar-right">
          <button className="btn-primary-action" onClick={openAddGroupModal}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add Group
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">Loading...</div>
      ) : (
        <div className="customization-groups-container">
          {filteredGroups.length === 0 ? (
            <div className="empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M12 3v18M3 12h18M7.5 7.5L16.5 16.5M16.5 7.5L7.5 16.5" />
              </svg>
              <p>No customization groups found</p>
            </div>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.group_id} className="customization-group-card">
                <div 
                  className="group-header"
                  onClick={() => toggleGroupExpand(group.group_id)}
                >
                  <div className="group-header-left">
                    <svg 
                      className={`expand-icon ${expandedGroup === group.group_id ? 'expanded' : ''}`}
                      width="20" 
                      height="20" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2"
                    >
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                    <div className="group-info">
                      <h3 className="group-name">{group.name}</h3>
                      <div className="group-meta">
                        <span className="meta-tag">{getSelectionTypeLabel(group.selection_type)}</span>
                        <span className="meta-tag">{getInputTypeLabel(group.input_type)}</span>
                        {group.is_required && <span className="meta-tag required">Required</span>}
                        <span className="meta-tag options-count">{group.options?.length || 0} options</span>
                      </div>
                    </div>
                  </div>
                  <div className="group-header-right" onClick={(e) => e.stopPropagation()}>
                    <span className={`status-badge ${group.status}`}>{group.status}</span>
                    <button className="btn-icon" onClick={() => openEditGroupModal(group)} title="Edit Group">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                      </svg>
                    </button>
                    <button className="btn-icon delete" onClick={() => openDeleteModal(group, "group")} title="Delete Group">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                    </button>
                  </div>
                </div>

                {expandedGroup === group.group_id && (
                  <div className="group-options-section">
                    <div className="options-header">
                      <h4>Options</h4>
                      <button 
                        className="btn-add-option" 
                        onClick={() => openAddOptionModal(group.group_id)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="5" x2="12" y2="19"></line>
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Add Option
                      </button>
                    </div>

                    {(!group.options || group.options.length === 0) ? (
                      <div className="no-options">No options added yet</div>
                    ) : (
                      <div className="options-table">
                        <div className="options-table-header">
                          <span>Name</span>
                          <span>Price</span>
                          <span>Per Unit</span>
                          <span>Max Qty</span>
                          <span>Status</span>
                          <span>Actions</span>
                        </div>
                        {group.options.map((option) => (
                          <div key={option.option_id} className="options-table-row">
                            <span className="option-name">{option.name}</span>
                            <span className="option-price">
                              {option.price > 0 ? `₱${parseFloat(option.price).toFixed(2)}` : 'Free'}
                            </span>
                            <span className="option-per-unit">
                              {option.price_per_unit > 0 ? `₱${parseFloat(option.price_per_unit).toFixed(2)}` : '-'}
                            </span>
                            <span className="option-max-qty">{option.max_quantity}</span>
                            <span className={`status-badge small ${option.status}`}>{option.status}</span>
                            <div className="option-actions">
                              <button 
                                className="btn-icon small" 
                                onClick={() => openEditOptionModal(option, group.group_id)}
                                title="Edit Option"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                                </svg>
                              </button>
                              <button 
                                className="btn-icon small delete" 
                                onClick={() => openDeleteModal(option, "option")}
                                title="Delete Option"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6"></polyline>
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Group Modal */}
      {showGroupModal && (
        <div className="modal-overlay" onClick={closeGroupModal}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px', width: '90%' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: '#333' }}>{editingGroup ? "Edit Customization Group" : "Add Customization Group"}</h3>
              <button className="modal-close" onClick={closeGroupModal} style={{ color: '#666' }}>×</button>
            </div>
            <form onSubmit={handleGroupSubmit}>
              <div className="form-group">
                <label className="form-label">Group Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={groupFormData.name}
                  onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                  placeholder="e.g., Temperature, Size, Syrup"
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Selection Type</label>
                  <select
                    className="form-select"
                    value={groupFormData.selection_type}
                    onChange={(e) => setGroupFormData({ ...groupFormData, selection_type: e.target.value })}
                  >
                    <option value="single">Single Select</option>
                    <option value="multiple">Multiple Select</option>
                  </select>
                  <small className="form-helper">
                    Single: customer picks one option only. Multiple: customer can pick several options.
                  </small>
                </div>
                <div className="form-group">
                  <label className="form-label">Input Type</label>
                  <select
                    className="form-select"
                    value={groupFormData.input_type}
                    onChange={(e) => setGroupFormData({ ...groupFormData, input_type: e.target.value })}
                  >
                    <option value="choice">Choice Selection</option>
                    <option value="quantity">Quantity Input</option>
                  </select>
                  <small className="form-helper">
                    Choice: buttons/radios. Quantity: +/- stepper.
                  </small>
                </div>
              </div>
              {/* Unit Label - only shown when input_type is 'quantity' */}
              {groupFormData.input_type === 'quantity' && (
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Unit Label *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g., pump, piece, serving, shot"
                      value={groupFormData.unit_label}
                      onChange={(e) => setGroupFormData({ ...groupFormData, unit_label: e.target.value })}
                      required
                    />
                    <small className="form-helper">This label appears after the price (e.g., ₱5.00/pump). Required for quantity-based groups.</small>
                  </div>
                </div>
              )}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Display Order</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="form-input"
                    value={groupFormData.display_order}
                    onChange={(e) => { if (e.target.value === '' || /^\d{1,3}$/.test(e.target.value)) setGroupFormData({ ...groupFormData, display_order: e.target.value }); }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={groupFormData.status}
                    onChange={(e) => setGroupFormData({ ...groupFormData, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-checkbox-label">
                  <input
                    type="checkbox"
                    checked={groupFormData.is_required}
                    onChange={(e) => setGroupFormData({ ...groupFormData, is_required: e.target.checked })}
                  />
                  <span className="checkbox-text">Required</span>
                  <span className="checkbox-hint">Customer must select an option from this group</span>
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeGroupModal}>Cancel</button>
                <button type="submit" className="btn-confirm">{editingGroup ? "Update Group" : "Add Group"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Option Modal */}
      {showOptionModal && (
        <div className="modal-overlay" onClick={closeOptionModal}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px', width: '90%' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: '#333' }}>{editingOption ? "Edit Option" : "Add New Option"}</h3>
              <button className="modal-close" onClick={closeOptionModal} style={{ color: '#666' }}>×</button>
            </div>
            <form onSubmit={handleOptionSubmit}>
              <div className="form-group">
                <label className="form-label">Option Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={optionFormData.name}
                  onChange={(e) => setOptionFormData({ ...optionFormData, name: e.target.value })}
                  placeholder="e.g., Hot, Large, Vanilla"
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Fixed Price (₱)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="form-input"
                    value={optionFormData.price}
                    onChange={(e) => { if (e.target.value === '' || /^\d*\.?\d{0,2}$/.test(e.target.value)) setOptionFormData({ ...optionFormData, price: e.target.value }); }}
                  />
                  <small className="form-helper">Additional price for this option (0 for free)</small>
                </div>
                <div className="form-group">
                  <label className="form-label">Price Per Unit (₱)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="form-input"
                    value={optionFormData.price_per_unit}
                    onChange={(e) => { if (e.target.value === '' || /^\d*\.?\d{0,2}$/.test(e.target.value)) setOptionFormData({ ...optionFormData, price_per_unit: e.target.value }); }}
                  />
                  <small className="form-helper">For quantity-based options (e.g., ₱5/pump)</small>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Max Quantity</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="form-input"
                    value={optionFormData.max_quantity}
                    onChange={(e) => { if (e.target.value === '' || /^\d{1,3}$/.test(e.target.value)) setOptionFormData({ ...optionFormData, max_quantity: e.target.value }); }}
                  />
                  <small className="form-helper">Maximum allowed quantity</small>
                </div>
                <div className="form-group">
                  <label className="form-label">Display Order</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="form-input"
                    value={optionFormData.display_order}
                    onChange={(e) => { if (e.target.value === '' || /^\d{1,3}$/.test(e.target.value)) setOptionFormData({ ...optionFormData, display_order: e.target.value }); }}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  value={optionFormData.status}
                  onChange={(e) => setOptionFormData({ ...optionFormData, status: e.target.value })}
                >
                  <option value="available">Available</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeOptionModal}>Cancel</button>
                <button type="submit" className="btn-confirm">{editingOption ? "Update Option" : "Add Option"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={closeDeleteModal}>
          <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: '#333' }}>Delete {deleteType === "group" ? "Group" : "Option"}</h3>
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
                Are you sure you want to delete <strong>"{deleteTarget?.name}"</strong>?
                {deleteType === "group" && <><br/><small>All options in this group will also be deleted.</small></>}
              </p>
              <p className="delete-warning">This action cannot be undone.</p>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={closeDeleteModal}>Cancel</button>
              <button type="button" className="btn-danger" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
