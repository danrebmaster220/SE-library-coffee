import { useState, useEffect } from "react";
import api from "../api";
import FilterSelectWrap from "../components/FilterSelectWrap";
import "../styles/menu-management-styles/index.css";

export default function Discounts() {
  const [discounts, setDiscounts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingDiscount, setEditingDiscount] = useState(null);
  const [filterSearch, setFilterSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [discountPage, setDiscountPage] = useState(1);
  const rowsPerPage = 10;
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    percentage: "",
    status: "active"
  });

  useEffect(() => {
    fetchDiscounts();
  }, []);

  const fetchDiscounts = async () => {
    try {
      const response = await api.get("/discounts");
      setDiscounts(response.data.discounts || response.data || []);
    } catch (error) {
      console.error("Error fetching discounts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        percentage: parseFloat(formData.percentage),
        status: formData.status
      };

      if (editingDiscount) {
        await api.put(`/discounts/${editingDiscount.discount_id}`, payload);
      } else {
        await api.post("/discounts", payload);
      }
      await fetchDiscounts();
      closeModal();
    } catch (error) {
      console.error("Error saving discount:", error);
      alert("Failed to save discount");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeleteModal = (discount) => {
    setDeleteTarget(discount);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/discounts/${deleteTarget.discount_id}`);
      await fetchDiscounts();
      closeDeleteModal();
    } catch (error) {
      console.error("Error deleting discount:", error);
      alert("Failed to delete discount");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (discount) => {
    setEditingDiscount(discount);
    setFormData({
      name: discount.name,
      percentage: discount.percentage.toString(),
      status: discount.status || "active"
    });
    setShowModal(true);
  };

  const openAddModal = () => {
    setEditingDiscount(null);
    setFormData({ name: "", percentage: "", status: "active" });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingDiscount(null);
    setFormData({ name: "", percentage: "", status: "active" });
  };

  const filteredDiscounts = discounts.filter((discount) => {
    const matchesSearch = discount.name.toLowerCase().includes(filterSearch.toLowerCase());
    const matchesStatus = !filterStatus || discount.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  useEffect(() => {
    setDiscountPage(1);
  }, [filterSearch, filterStatus, discounts]);

  const totalPages = Math.ceil(filteredDiscounts.length / rowsPerPage);
  const startIndex = (discountPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedDiscounts = filteredDiscounts.slice(startIndex, endIndex);

  const getPageNumbers = (page, pages) => {
    const result = [];
    const maxVisiblePages = 5;

    if (pages <= maxVisiblePages) {
      for (let i = 1; i <= pages; i++) result.push(i);
    } else if (page <= 3) {
      result.push(1, 2, 3, 4, '...', pages);
    } else if (page >= pages - 2) {
      result.push(1, '...', pages - 3, pages - 2, pages - 1, pages);
    } else {
      result.push(1, '...', page - 1, page, page + 1, '...', pages);
    }

    return result;
  };

  return (
    <div className="main-content">
      <div className="page-header-section">
        <div className="page-title-group">
          <h1 className="page-title">Discounts</h1>
          <p className="page-subtitle">Manage discount types and percentages</p>
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
              placeholder="Search discounts..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
            />
          </div>
          <div className="toolbar-filters-actions">
            <FilterSelectWrap>
              <select
                className="filter-select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </FilterSelectWrap>
          </div>
        </div>
        <div className="toolbar-right">
          <button className="btn-primary-action" onClick={openAddModal}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add Discount
          </button>
        </div>
      </div>

      <div className="table-card">
        {loading ? (
          <div className="loading-state">Loading discounts...</div>
        ) : filteredDiscounts.length === 0 ? (
          <div className="empty-state">
            <p>No discounts found. Add your first discount!</p>
          </div>
        ) : (
          <>
            <div className="table-scroll-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Discount Name</th>
                    <th>Percentage</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDiscounts.map((discount) => (
                    <tr key={discount.discount_id}>
                      <td>#{discount.discount_id}</td>
                      <td><span className="item-name-text">{discount.name}</span></td>
                      <td>
                      <span className="percentage-badge">{discount.percentage}%</span>
                    </td>
                    <td>
                      <span className={`status-badge ${discount.status === "active" ? "status-active" : "status-inactive"}`}>
                        {discount.status === "active" ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn-action btn-edit" onClick={() => openEditModal(discount)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                          Edit
                        </button>
                        <button className="btn-action btn-delete" onClick={() => openDeleteModal(discount)}>
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

            {totalPages > 1 && (
              <div className="pagination-container">
                <span className="pagination-info">
                  Showing {startIndex + 1}-{Math.min(endIndex, filteredDiscounts.length)} of {filteredDiscounts.length}
                </span>
                <button className="pagination-btn" onClick={() => setDiscountPage(1)} disabled={discountPage === 1}>«</button>
                <button className="pagination-btn" onClick={() => setDiscountPage(discountPage - 1)} disabled={discountPage === 1}>‹</button>
                {getPageNumbers(discountPage, totalPages).map((page, idx) => (
                  page === '...' ? (
                    <span key={`ellipsis-${idx}`} className="pagination-ellipsis">...</span>
                  ) : (
                    <button key={page} className={discountPage === page ? "pagination-btn active" : "pagination-btn"} onClick={() => setDiscountPage(page)}>{page}</button>
                  )
                ))}
                <button className="pagination-btn" onClick={() => setDiscountPage(discountPage + 1)} disabled={discountPage === totalPages}>›</button>
                <button className="pagination-btn" onClick={() => setDiscountPage(totalPages)} disabled={discountPage === totalPages}>»</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add/Edit Discount Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingDiscount ? "Edit Discount" : "Add New Discount"}</h3>
              <button className="modal-close" onClick={closeModal}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Discount Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Senior Citizen, PWD, Employee"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Percentage (%)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="form-input"
                  value={formData.percentage}
                  onChange={(e) => { if (e.target.value === '' || /^\d*\.?\d{0,2}$/.test(e.target.value)) setFormData({ ...formData, percentage: e.target.value }); }}
                  placeholder="e.g., 20"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <FilterSelectWrap fullWidth>
                  <select
                    className="form-select"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </FilterSelectWrap>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-confirm" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : (editingDiscount ? "Save Changes" : "Add Discount")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteTarget && (
        <div className="modal-overlay" onClick={closeDeleteModal}>
          <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Delete Discount</h3>
              <button className="modal-close" onClick={closeDeleteModal}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
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
              <button type="button" className="btn-danger" onClick={confirmDelete} disabled={isSubmitting}>
                {isSubmitting ? "Deleting..." : "Delete Discount"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
