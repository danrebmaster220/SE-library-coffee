import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import FilterSelectWrap from "../components/FilterSelectWrap";
import "../styles/menu-management-styles/index.css";

export default function ManageMenu() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pendingSearch, setPendingSearch] = useState("");
  const [pendingCategory, setPendingCategory] = useState("");
  const [pendingStatus, setPendingStatus] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedCategory, setAppliedCategory] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("");
  const [itemPage, setItemPage] = useState(1);
  const rowsPerPage = 10;
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [itemsRes, categoriesRes] = await Promise.all([
        api.get("/menu/items"),
        api.get("/menu/categories")
      ]);
      setItems(itemsRes.data.items || itemsRes.data || []);
      setCategories(categoriesRes.data.categories || categoriesRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
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
    if (!deleteTarget) return;
    try {
      await api.delete(`/menu/items/${deleteTarget.item_id}`);
      fetchData();
      closeDeleteModal();
    } catch (error) {
      console.error("Error deleting item:", error);
      alert("Failed to delete item");
    }
  };

  const toggleStatus = async (item) => {
    try {
      const newStatus = item.status === "available" ? "sold_out" : "available";
      await api.put(`/menu/items/${item.item_id}`, { ...item, status: newStatus });
      fetchData();
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find((c) => c.category_id === categoryId);
    return category ? category.name : "Unknown";
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(appliedSearch.toLowerCase());
    const matchesCategory = !appliedCategory || item.category_id === parseInt(appliedCategory);
    const matchesStatus = !appliedStatus || item.status === appliedStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  useEffect(() => {
    setItemPage(1);
  }, [appliedSearch, appliedCategory, appliedStatus, items]);

  const applyFilters = () => {
    setAppliedSearch(pendingSearch);
    setAppliedCategory(pendingCategory);
    setAppliedStatus(pendingStatus);
    setItemPage(1);
  };

  const totalPages = Math.ceil(filteredItems.length / rowsPerPage);
  const startIndex = (itemPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, endIndex);

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
          <h1 className="page-title">All Items</h1>
          <p className="page-subtitle">View and manage all menu items</p>
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
              value={pendingSearch}
              onChange={(e) => setPendingSearch(e.target.value)}
            />
          </div>
          <div className="toolbar-filters-actions">
            <FilterSelectWrap>
              <select
                className="filter-select"
                value={pendingCategory}
                onChange={(e) => setPendingCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.category_id} value={cat.category_id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </FilterSelectWrap>
            <FilterSelectWrap>
              <select
                className="filter-select"
                value={pendingStatus}
                onChange={(e) => setPendingStatus(e.target.value)}
              >
                <option value="">All Status</option>
                <option value="available">Available</option>
                <option value="sold_out">Sold Out</option>
              </select>
            </FilterSelectWrap>
            <button type="button" className="btn-apply-filter" onClick={applyFilters}>
              Apply Filter
            </button>
          </div>
        </div>
        <div className="toolbar-right">
          <button className="btn-primary-action" onClick={() => navigate("/menu/categories")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14"></path>
              <path d="M12 5l7 7-7 7"></path>
            </svg>
            Add Category
          </button>
          <button className="btn-primary-action" onClick={() => navigate("/menu/items")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14"></path>
              <path d="M12 5l7 7-7 7"></path>
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
          <>
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
                {paginatedItems.map((item) => (
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
                      <span 
                        className={`status-badge ${item.status === "available" ? "status-available" : "status-soldout"}`}
                        onClick={() => toggleStatus(item)}
                        style={{ cursor: "pointer" }}
                      >
                        {item.status === "available" ? "Available" : "Sold Out"}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn-action btn-edit" onClick={() => navigate(`/menu/items?edit=${item.item_id}`)}>
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

            {totalPages > 1 && (
              <div className="pagination-container">
                <span className="pagination-info">
                  Showing {startIndex + 1}-{Math.min(endIndex, filteredItems.length)} of {filteredItems.length}
                </span>
                <button className="pagination-btn" onClick={() => setItemPage(1)} disabled={itemPage === 1}>«</button>
                <button className="pagination-btn" onClick={() => setItemPage(itemPage - 1)} disabled={itemPage === 1}>‹</button>
                {getPageNumbers(itemPage, totalPages).map((page, idx) => (
                  page === '...' ? (
                    <span key={`ellipsis-${idx}`} className="pagination-ellipsis">...</span>
                  ) : (
                    <button key={page} className={itemPage === page ? "pagination-btn active" : "pagination-btn"} onClick={() => setItemPage(page)}>{page}</button>
                  )
                ))}
                <button className="pagination-btn" onClick={() => setItemPage(itemPage + 1)} disabled={itemPage === totalPages}>›</button>
                <button className="pagination-btn" onClick={() => setItemPage(totalPages)} disabled={itemPage === totalPages}>»</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteTarget && (
        <div className="modal-overlay" onClick={closeDeleteModal}>
          <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Delete Item</h3>
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
              <button type="button" className="btn-danger" onClick={confirmDelete}>
                Delete Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
