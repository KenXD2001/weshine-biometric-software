import React, { useState, useEffect } from "react";
import { Content } from "../../_metronic/layout/components/content";
import { downloadJson, labDetailsCandidateSeatingDetails } from "../helpers/api";
import { API_URL } from "../helpers/constants";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./BiometricCandidateList.css";

const BiometricCandidateList: React.FC = () => {
  // State Initialization Start
  type CandidateData = {
    candidateId: number;
    candidateName: string;
    hallTicket: string;
    emailId: string;
    phone: string;
    gender: string;
    faceStatus: string;
    thumbStatus: string;
    biometricStatus: string;
    matchPercentage: number | null;
    centreCode: string;
    centreName: string;
    examSlot: string;
    // Image paths
    uploadedImagePath: string | null;
    liveImagePath: string | null;
    capturedImagePath: string | null;
    biometricImagePath: string | null;
    // Timestamps
    imageCaptureTimestamp: string | null;
    thumbCaptureTimestamp: string | null;
    submitTimestamp: string | null;
  }

  // Initial state for generatedHallTicket data array
  const [candidateBiometricData, setCandidateBiometricData] = useState<CandidateData[]>([]);


  // Sorting, selection, and pagination states
  const [sortingOrder, setSortingOrder] = useState<"asc" | "desc" | null>(
    "asc"
  );
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [searchTerm, setSearchTerm] = useState("");
  
  // Auto-refresh state
  const [refreshInterval, setRefreshInterval] = useState<number>(10); // Default 10 seconds
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState<boolean>(true); // Enabled by default
  
  // Filter state for biometric status
  const [statusFilter, setStatusFilter] = useState<string>("All"); // "All", "Pending", "Completed"

  // Event Handlers


  // Search box filter logic
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1); // Reset page number when search term changes
  };

  // Status filter change handler
  const handleStatusFilterChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setCurrentPage(1); // Reset page number when status filter changes
  };

  // Sorting logic for "Hall Ticket" column
  const sortCandidateByHallTicket = () => {
    if (sortingOrder === "asc") {
      setSortingOrder("desc");
    } else {
      setSortingOrder("asc");
    }
    setCurrentPage(1); // Reset to first page when sorting changes
  };

  const getLabelClass = (status: string) => {
    switch (status) {
      case "Pending":
        return "badge bg-warning text-dark fw-bold"; // Orange with dark text
      case "Completed":
        return "badge bg-success text-white fw-bold"; // Green
      default:
        return "badge bg-secondary text-white fw-bold"; // Default grey
    }
  };

  // New badge style for "No image" status
  const getNoImageBadge = () => {
    return "badge bg-light text-dark border fw-bold";
  };

  // Helper function to format timestamp
  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return 'Not captured';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  // Helper function to render image or pending text (compact version)
  const renderImageOrPending = (imagePath: string | null, status: string, type: string) => {
    console.log('🔍 renderImageOrPending called:', { imagePath, status, type });
    
    if (status === 'Completed' && imagePath) {
      return (
        <div className="position-relative">
          <img 
            src={`${API_URL}${imagePath}`} 
            alt={`${type} captured`}
            className="img-thumb-compact"
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement;
              target.style.display = 'none';
              const nextElement = target.nextElementSibling as HTMLElement;
              if (nextElement) nextElement.style.display = 'flex';
            }}
          />
          <div 
            className="icon-placeholder"
            style={{ display: 'none' }}
          >
            <i className="fas fa-exclamation-triangle text-danger"></i>
          </div>
        </div>
      );
    } else {
      return (
        <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '40px' }}>
          <span className="text-muted small">{status || 'Pending'}</span>
        </div>
      );
    }
  };

  // Helper function to render uploaded/live image (compact version)
  const renderUploadedImage = (imagePath: string | null) => {
    console.log('🔍 renderUploadedImage called:', { imagePath });
    
    if (imagePath) {
      return (
        <div className="position-relative">
          <img 
            src={`${API_URL}${imagePath}`} 
            alt="Candidate"
            className="img-thumb-compact"
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement;
              target.style.display = 'none';
              const nextElement = target.nextElementSibling as HTMLElement;
              if (nextElement) nextElement.style.display = 'flex';
            }}
          />
          <div 
            className="icon-placeholder"
            style={{ display: 'none' }}
          >
            <i className="fas fa-exclamation-triangle text-danger"></i>
          </div>
        </div>
      );
    }
    return (
      <div className="icon-placeholder">
        <i className="fas fa-image text-secondary"></i>
      </div>
    );
  };

  // Table Filter and Sorting Logic
  const filteredData = Array.isArray(candidateBiometricData)
    ? candidateBiometricData.filter((candidate) => {
        // Search filter
        const matchesSearch = (candidate.hallTicket &&
          candidate.hallTicket
      .toLowerCase()
            .includes(searchTerm.toLowerCase())) ||
        (candidate.candidateName &&
          candidate.candidateName
        .toLowerCase()
        .includes(searchTerm.toLowerCase())) ||
        (candidate.emailId &&
          candidate.emailId
        .toLowerCase()
        .includes(searchTerm.toLowerCase()));
        
        // Status filter
        const matchesStatus = statusFilter === "All" || candidate.biometricStatus === statusFilter;
        
        return matchesSearch && matchesStatus;
      }).sort((a, b) => {
        // Sort by status priority when filter is applied
        if (statusFilter === "Pending") {
          // Pending first, then others
          if (a.biometricStatus === "Pending" && b.biometricStatus !== "Pending") return -1;
          if (a.biometricStatus !== "Pending" && b.biometricStatus === "Pending") return 1;
        } else if (statusFilter === "Completed") {
          // Completed first, then others
          if (a.biometricStatus === "Completed" && b.biometricStatus !== "Completed") return -1;
          if (a.biometricStatus !== "Completed" && b.biometricStatus === "Completed") return 1;
        }
        
        // Secondary sort by hall ticket (maintain existing sorting)
        if (sortingOrder === "asc") {
          return a.hallTicket.localeCompare(b.hallTicket);
        } else if (sortingOrder === "desc") {
          return b.hallTicket.localeCompare(a.hallTicket);
        }
        
        // Default sort by hall ticket ascending
        return a.hallTicket.localeCompare(b.hallTicket);
      })
    : [];

  // Pagination calculation - MUST come before renderPagination
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const validCurrentPage = Math.min(Math.max(currentPage, 1), totalPages || 1);
  
  const indexOfFirstItem = (validCurrentPage - 1) * itemsPerPage;
  const indexOfLastItem = Math.min(indexOfFirstItem + itemsPerPage, totalItems);
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);

  // Debug logging
  console.log('Pagination Debug:', {
    totalItems,
    totalPages,
    currentPage,
    validCurrentPage,
    itemsPerPage,
    indexOfFirstItem,
    indexOfLastItem,
    currentItemsLength: currentItems.length,
    statusFilter,
    searchTerm
  });

  // Pagination UI rendering
  const renderPagination = () => {
    if (totalPages <= 1) {
      return null;
    }

    const pageNumbers = [];
    for (let i = 1; i <= totalPages; i++) {
      pageNumbers.push(i);
    }

    return (
      <nav aria-label="Candidate list pagination">
        <ul className="pagination pagination-sm mb-0">
          <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
            <button
              className="page-link cus-btn-pagination"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <i className="fas fa-chevron-left me-1"></i>
              Previous
            </button>
          </li>
          {pageNumbers.map((pageNumber) => (
            <li
              key={pageNumber}
              className={`page-item ${currentPage === pageNumber ? "active" : ""}`}
            >
              <button
                className="page-link cus-btn-pagination"
                onClick={() => setCurrentPage(pageNumber)}
              >
                {pageNumber}
              </button>
            </li>
          ))}
          <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
            <button
              className="page-link cus-btn-pagination"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
              <i className="fas fa-chevron-right ms-1"></i>
            </button>
          </li>
        </ul>
      </nav>
    );
  };

  // Fetch data function
    const fetchData = async () => {
      try {
      const examId = parseInt(localStorage.getItem("examId") || "0", 10);
      const examSlot = localStorage.getItem("examSlot") || "";

      const response = await labDetailsCandidateSeatingDetails(examId, examSlot);
        
        // Ensure response is an array before setting state
        if (response && Array.isArray(response)) {
        setCandidateBiometricData(response);
        } else if (response && typeof response === 'object' && response.error) {
          console.error('API Error:', response.error);
          // Keep existing data on error, don't crash the UI
        } else {
          console.error('Invalid response format:', response);
        }
      } catch (error) {
        console.error('Error fetching candidate data:', error);
        // Keep existing data on error
      }
    };

  // Initial data load - runs only once on mount
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - runs only once on component mount

  // Auto-refresh effect
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (isAutoRefreshEnabled && refreshInterval > 0) {
      intervalId = setInterval(() => {
        console.log(`Auto-refreshing data (every ${refreshInterval}s)...`);
        fetchData();
      }, refreshInterval * 1000);
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isAutoRefreshEnabled, refreshInterval]);

  // Validate current page when filtered data changes
  useEffect(() => {
    const totalPagesCalc = Math.ceil(filteredData.length / itemsPerPage);
    if (currentPage > totalPagesCalc && totalPagesCalc > 0) {
      setCurrentPage(1);
    }
  }, [filteredData.length, currentPage, itemsPerPage]);

const [isLoading, setIsLoading] = useState(false);
  // Download candidates_biometric.json file from backend
  const downloadFile = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/candidate-details/biometric-data`);
      const jsonData = await response.json();
      
      if (!Array.isArray(jsonData)) {
        throw new Error('Invalid response format');
      }
      
      const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = "candidates_biometric.json";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(href);
    } catch (error) {
      console.error("Error downloading JSON file:", error);
      alert("Failed to download JSON file. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to convert image URL to base64
  const getImageBase64 = async (imagePath: string | null): Promise<string | null> => {
    if (!imagePath) return null;
    
    try {
      // All image paths should now be full paths (either /api/... or /uploads/...)
      const fullUrl = `${API_URL}${imagePath}`;
      
      console.log('🖼️ Loading image:', { imagePath, fullUrl });
      
      const response = await fetch(fullUrl);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          console.log('✅ Image loaded successfully:', imagePath);
          resolve(reader.result as string);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('❌ Error loading image:', { imagePath, error });
      return null;
    }
  };

  // Export table data as PDF with images (matching UI table structure)
  const downloadPDF = async () => {
    try {
      const doc = new jsPDF('landscape', 'mm', 'a4');
      
      // Add title and header
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Biometric Candidate List', 14, 15);
      
      // Add exam details
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const examDate = localStorage.getItem("examDate") || 
                       (localStorage.getItem("examSlot") || "").split(' ')[0] || 
                       "Not Set";
      const examSlot = (() => {
        const slot = localStorage.getItem("examSlot");
        if (slot && slot.includes(' ')) return slot.split(' ')[1];
        return slot || "Not Set";
      })();
      doc.text(`Exam Date: ${examDate} | Slot: ${examSlot} | Generated: ${new Date().toLocaleString()}`, 14, 22);
      doc.text(`Total: ${candidateBiometricData.length} | Completed: ${candidateBiometricData.filter(c => c.biometricStatus === 'Completed').length}`, 14, 27);
      
      // Prepare table data with images
      const tableData = await Promise.all(candidateBiometricData.map(async (candidate) => {
        console.log('🔍 Processing candidate for table:', {
          candidateId: candidate.candidateId,
          capturedImagePath: candidate.capturedImagePath,
          biometricImagePath: candidate.biometricImagePath
        });
        
        // Load all images
        const uploadedImg = await getImageBase64(candidate.uploadedImagePath);
        const liveImg = await getImageBase64(candidate.liveImagePath);
        const faceImg = await getImageBase64(candidate.capturedImagePath);
        const thumbImg = await getImageBase64(candidate.biometricImagePath);
        
        console.log('📊 Image loading results for', candidate.candidateId, {
          uploadedImg: !!uploadedImg,
          liveImg: !!liveImg,
          faceImg: !!faceImg,
          thumbImg: !!thumbImg
        });
        
        return {
          hallTicket: candidate.hallTicket,
          name: candidate.candidateName,
          gender: candidate.gender,
          email: candidate.emailId,
          phone: candidate.phone,
          uploadedImg,
          liveImg,
          faceImg,
          thumbImg,
          faceStatus: candidate.faceStatus,
          thumbStatus: candidate.thumbStatus,
          biometricStatus: candidate.biometricStatus,
          matchPercentage: candidate.matchPercentage ? `${candidate.matchPercentage.toFixed(1)}%` : '-',
          imageCaptureTime: formatTimestamp(candidate.imageCaptureTimestamp),
          thumbCaptureTime: formatTimestamp(candidate.thumbCaptureTimestamp),
          submitTime: formatTimestamp(candidate.submitTimestamp)
        };
      }));
      
      // Generate table with images
      autoTable(doc, {
        startY: 32,
        head: [[
          'Hall Ticket',
          'Candidate Name',
          'Email',
          'Photo',
          'Live',
          'Face',
          'Thumb',
          'Biometric Status',
          'Capture Timing'
        ]],
        body: tableData.map(row => [
          row.hallTicket,
          `${row.name}\n${row.gender}`,
          row.email,
          '', // Photo (image will be added in didDrawCell)
          '', // Live (image will be added in didDrawCell)
          '', // Face (image will be added in didDrawCell)
          '', // Thumb (image will be added in didDrawCell)
          `${row.biometricStatus}\n${row.matchPercentage}`,
          `Face: ${row.imageCaptureTime}\nThumb: ${row.thumbCaptureTime}\nSubmit: ${row.submitTime}`
        ]),
        theme: 'grid',
        headStyles: {
          fillColor: [13, 110, 253], // Blue color matching UI
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'center'
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 3,
          valign: 'middle'
        },
        columnStyles: {
          0: { cellWidth: 30, halign: 'center' },  // Hall Ticket
          1: { cellWidth: 28 },                     // Name + Gender
          2: { cellWidth: 40 },                     // Email
          3: { cellWidth: 20, halign: 'center' },  // Photo
          4: { cellWidth: 20, halign: 'center' },  // Live
          5: { cellWidth: 20, halign: 'center' },  // Face
          6: { cellWidth: 20, halign: 'center' },  // Thumb
          7: { cellWidth: 28, halign: 'center' },  // Status
          8: { cellWidth: 50 }                      // Capture Timing
        },
        didDrawCell: (data: any) => {
          // Add images to the cells
          if (data.section === 'body') {
            const rowData = tableData[data.row.index];
            const cellPadding = 2;
            const imgSize = data.cell.height - (cellPadding * 2);
            const imgX = data.cell.x + (data.cell.width - imgSize) / 2;
            const imgY = data.cell.y + cellPadding;
            
            // Column 3: Photo
            if (data.column.index === 3 && rowData.uploadedImg) {
              doc.addImage(rowData.uploadedImg, 'PNG', imgX, imgY, imgSize, imgSize);
            }
            
            // Column 4: Live
            if (data.column.index === 4 && rowData.liveImg) {
              doc.addImage(rowData.liveImg, 'PNG', imgX, imgY, imgSize, imgSize);
            }
            
            // Column 5: Face
            if (data.column.index === 5 && rowData.faceImg) {
              doc.addImage(rowData.faceImg, 'PNG', imgX, imgY, imgSize, imgSize);
            }
            
            // Column 6: Thumb
            if (data.column.index === 6 && rowData.thumbImg) {
              doc.addImage(rowData.thumbImg, 'BMP', imgX, imgY, imgSize, imgSize);
            }
          }
        },
        margin: { top: 32, left: 10, right: 10 },
        rowPageBreak: 'avoid'
      });
      
      // Save the PDF
      const fileName = `biometric_candidates_${examDate.replace(/-/g, '')}_${new Date().getTime()}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please try again.");
    }
  };

  return (
    <Content>
      {/* Main Card Container */}
      <div className="card compact-card border-0">
        {/* Merged Header with Controls */}
        <div className="card-header-compact text-white">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div className="d-flex align-items-center gap-3">
              <h3 className="mb-0 fw-bold text-white">Biometric Candidate List</h3>
            </div>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-light btn-sm"
                onClick={downloadPDF}
              >
                <i className="fas fa-file-pdf me-1"></i>
                Export PDF
              </button>
        <button
          type="button"
                className="btn btn-light btn-sm"
          onClick={downloadFile}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
                    <span className="spinner-border spinner-border-sm me-1" role="status" />
              Exporting...
            </>
          ) : (
                  <>
                    <i className="fas fa-download me-1"></i>
                    Export JSON
                  </>
          )}
        </button>
</div>
          </div>
          
          {/* Integrated Search and Filters */}
          <div className="row g-2 align-items-center">
            <div className="col-md-3">
              <div className="position-relative">
                <i className="fas fa-search position-absolute" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6c757d' }}></i>
                <input
                  type="text"
                  className="form-control form-control-sm search-input-compact bg-white"
                  placeholder="Search by Hall Ticket, Name, or Email..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                />
              </div>
            </div>
            <div className="col-md-2">
              <select
                className="form-select form-select-sm bg-white"
                value={statusFilter}
                onChange={(e) => handleStatusFilterChange(e.target.value)}
              >
                <option value="All">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            <div className="col-md-3">
              <div className="d-flex justify-content-center">
                <div className="d-flex align-items-center bg-white bg-opacity-10 px-3 py-2 rounded-pill" style={{ gap: '2rem' }}>
                  <div className="d-flex align-items-center text-white small">
                    <i className="fas fa-users me-2"></i>
                    <span className="fw-bold">Total: {candidateBiometricData.length}</span>
                  </div>

                  <div className="d-flex align-items-center text-white small">
                    <i className="fas fa-check-circle text-success me-2"></i>
                    <span className="fw-bold text-success">Completed: {Array.isArray(candidateBiometricData) ? candidateBiometricData.filter(c => c.biometricStatus === 'Completed').length : 0}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="d-flex gap-2 justify-content-md-end">
                <div className="form-check form-switch d-flex align-items-center mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={isAutoRefreshEnabled}
                    onChange={(e) => setIsAutoRefreshEnabled(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <label className="form-check-label text-white ms-2 small" style={{ cursor: 'pointer' }}>
                    Auto-refresh
                  </label>
                </div>
                <select
                  className="form-select form-select-sm"
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  disabled={!isAutoRefreshEnabled}
                  style={{ width: 'auto', minWidth: '80px' }}
                >
                  <option value={5}>5s</option>
                  <option value={10}>10s</option>
                  <option value={15}>15s</option>
                  <option value={30}>30s</option>
                  <option value={60}>1m</option>
                </select>
                <button
                  className="btn btn-light btn-sm"
                  onClick={fetchData}
                  title="Refresh now"
                >
                  <i className="fas fa-sync-alt"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="table-responsive">
          <table className="table table-compact table-hover align-middle mb-0">
              <thead>
              <tr>
                <th className="cursor-pointer text-center" onClick={sortCandidateByHallTicket} style={{ minWidth: '160px' }}>
                  Hall Ticket
                    {sortingOrder === "asc" ? (
                    <i className="fas fa-sort-down ms-1 text-white"></i>
                    ) : sortingOrder === "desc" ? (
                    <i className="fas fa-sort-up ms-1 text-white"></i>
                    ) : (
                    <i className="fas fa-sort ms-1 text-white"></i>
                    )}
                  </th>
                <th style={{ minWidth: '150px' }}>Candidate Name</th>
                <th style={{ minWidth: '200px' }}>Email</th>
                <th className="text-center" style={{ width: '90px' }}>Photo</th>
                <th className="text-center" style={{ width: '90px' }}>Live</th>
                <th className="text-center" style={{ width: '90px' }}>Face</th>
                <th className="text-center" style={{ width: '90px' }}>Thumb</th>
                <th className="text-center" style={{ width: '130px' }}>Biometric Status</th>
                <th style={{ minWidth: '180px' }}>Capture and Submit Timing</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-5">
                    <i className="fas fa-inbox text-muted fa-3x mb-3"></i>
                    <h6 className="text-muted">No candidates found</h6>
                    <small className="text-muted">Try adjusting your search or refresh the data</small>
                  </td>
                </tr>
              ) : currentItems.map((candidate, index) => {
                  console.log('🎯 Rendering table row for candidate:', {
                    candidateId: candidate.candidateId,
                    hallTicket: candidate.hallTicket,
                    faceStatus: candidate.faceStatus,
                    thumbStatus: candidate.thumbStatus,
                    capturedImagePath: candidate.capturedImagePath,
                    biometricImagePath: candidate.biometricImagePath
                  });
                  
                  return (
                  <tr key={candidate.candidateId}>
                  <td className="text-center">
                    <div className="fw-bold text-dark text-cell">{candidate.hallTicket}</div>
                    </td>
                    <td>
                    <div className="fw-bold text-dark text-cell mb-1">{candidate.candidateName}</div>
                    <small className="text-muted text-capitalize">
                      {candidate.gender}
                    </small>
                    </td>
                    <td>
                    <div className="text-dark text-cell">{candidate.emailId}</div>
                    </td>
                  <td className="text-center">
                    {renderUploadedImage(candidate.uploadedImagePath)}
                    </td>
                  <td className="text-center">
                    {renderUploadedImage(candidate.liveImagePath)}
                    </td>
                  <td className="text-center">
                    {renderImageOrPending(candidate.capturedImagePath, candidate.faceStatus, 'Face')}
                    </td>
                  <td className="text-center">
                    {renderImageOrPending(candidate.biometricImagePath, candidate.thumbStatus, 'Thumb')}
                    </td>
                  <td className="text-center">
                    <div>
                      <span className={`${getLabelClass(candidate.biometricStatus)} badge-compact`}>
                        {candidate.biometricStatus}
                      </span>
                    </div>
                    {candidate.matchPercentage && (
                      <div className="mt-2">
                        <small className="text-success fw-bold">
                          Match: {candidate.matchPercentage.toFixed(1)}%
                        </small>
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="timing-compact">
                      <div className="mb-1">
                        <i className="fas fa-camera text-info me-2"></i>
                        <span className="text-dark">{formatTimestamp(candidate.imageCaptureTimestamp)}</span>
                      </div>
                      <div className="mb-1">
                        <i className="fas fa-fingerprint text-warning me-2"></i>
                        <span className="text-dark">{formatTimestamp(candidate.thumbCaptureTimestamp)}</span>
                      </div>
                      <div>
                        <i className="fas fa-check-circle text-success me-2"></i>
                        <span className="text-dark">{formatTimestamp(candidate.submitTimestamp)}</span>
                      </div>
                    </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
        </div>

        {/* Footer with Pagination */}
        <div className="card-footer bg-white border-top py-2">
          <div className="d-flex justify-content-between align-items-center">
            <small className="text-muted">
              Showing <span className="fw-semibold">{totalItems > 0 ? indexOfFirstItem + 1 : 0}</span> to <span className="fw-semibold">{indexOfLastItem}</span> of <span className="fw-semibold">{totalItems}</span> candidates
            </small>
            <div>{renderPagination()}</div>
          </div>
        </div>
      </div>
    </Content>
  );
};

export { BiometricCandidateList };
