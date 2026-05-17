import {
  ArchiveBoxIcon,
  ArrowUturnLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Square3Stack3DIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { FocusTrap } from "focus-trap-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import formatKeyForDisplay from "@/components/inputs/ShortcutInput/formatKeyForDisplay";
import ConfirmModal from "@/components/modals/ConfirmModal/ConfirmModal";
import FileViewer from "@/components/widgets/FileViewer/FileViewer";
import PushButton from "@/components/widgets/PushButton/PushButton";
import { useShortcut } from "@/hooks/useShortcut";
import { usePageStore } from "@/store/pageStore";
import { usePreferencesStore } from "@/store/preferencesStore";

import "./index.css";

const ArchiveDeleteModal: React.FC = () => {
  const {
    archiveDeleteMode,
    pendingArchiveDeleteOperations,
    isProcessingArchiveDelete,
    actions: {
      closeArchiveDeleteMode,
      nextArchiveDeleteImage,
      previousArchiveDeleteImage,
      addPendingOperation,
      removePendingOperation,
      clearPendingOperations,
      executePendingOperations,
    },
    loadedFiles,
    fileIdToIndex,
  } = usePageStore();

  // Confirmation dialog state for close
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Get customizable keyboard shortcuts from preferences store
  const keyboardShortcuts = usePreferencesStore(
    (state) => state.keyboardShortcuts.archiveDeleteModal,
  );

  const currentFileId = archiveDeleteMode.active
    ? archiveDeleteMode.fileIds[archiveDeleteMode.currentIndex]
    : null;

  const currentFileData = currentFileId
    ? (() => {
        const index = fileIdToIndex.get(currentFileId);
        return index !== undefined ? loadedFiles[index] : undefined;
      })()
    : undefined;

  const hasPrevious = archiveDeleteMode.currentIndex > 0;
  const hasNext =
    archiveDeleteMode.currentIndex < archiveDeleteMode.fileIds.length - 1;

  // Get the pending operation for the current file
  const currentOperation = useMemo(() => {
    if (!currentFileId) return undefined;
    return pendingArchiveDeleteOperations.find(
      (op) => op.fileId === currentFileId,
    );
  }, [currentFileId, pendingArchiveDeleteOperations]);

  // Navigate to next file or show summary
  const navigateToNextOrShowSummary = useCallback(() => {
    if (hasNext) {
      nextArchiveDeleteImage();
    } else if (hasPrevious) {
      previousArchiveDeleteImage();
    }
  }, [
    hasNext,
    hasPrevious,
    nextArchiveDeleteImage,
    previousArchiveDeleteImage,
  ]);

  const handleArchive = useCallback(() => {
    if (!currentFileId || isProcessingArchiveDelete) return;

    // Add to pending operations via store action
    addPendingOperation(currentFileId, "archive");

    // Navigate to next file
    navigateToNextOrShowSummary();
  }, [
    currentFileId,
    isProcessingArchiveDelete,
    navigateToNextOrShowSummary,
    addPendingOperation,
  ]);

  const handleDelete = useCallback(() => {
    if (!currentFileId || isProcessingArchiveDelete) return;

    // Add to pending operations via store action
    addPendingOperation(currentFileId, "delete");

    // Navigate to next file
    navigateToNextOrShowSummary();
  }, [
    currentFileId,
    isProcessingArchiveDelete,
    navigateToNextOrShowSummary,
    addPendingOperation,
  ]);

  const handleUndo = useCallback(() => {
    if (!currentFileId) return;

    removePendingOperation(currentFileId);
  }, [currentFileId, removePendingOperation]);

  const handleSkip = useCallback(() => {
    navigateToNextOrShowSummary();
  }, [navigateToNextOrShowSummary]);

  const handlePrevious = useCallback(() => {
    if (hasPrevious) {
      previousArchiveDeleteImage();
    }
  }, [hasPrevious, previousArchiveDeleteImage]);

  const handleNext = useCallback(() => {
    if (hasNext) {
      nextArchiveDeleteImage();
    }
  }, [hasNext, nextArchiveDeleteImage]);

  const handleClose = useCallback(() => {
    if (pendingArchiveDeleteOperations.length > 0) {
      // Show confirmation dialog
      setShowCloseConfirm(true);
    } else {
      // No pending operations, close immediately
      closeArchiveDeleteMode();
    }
  }, [pendingArchiveDeleteOperations.length, closeArchiveDeleteMode]);

  const handleExecutePendingOperations = useCallback(async () => {
    setShowCloseConfirm(false);
    await executePendingOperations();
  }, [executePendingOperations]);

  const handleDiscardChanges = useCallback(() => {
    clearPendingOperations();
    closeArchiveDeleteMode();
    setShowCloseConfirm(false);
  }, [clearPendingOperations, closeArchiveDeleteMode]);

  // Build shortcut map dynamically from preferences store
  const shortcutMap = useMemo(
    () => ({
      Escape: handleClose,
      [keyboardShortcuts.archive]: handleArchive,
      [keyboardShortcuts.delete]: handleDelete,
      [keyboardShortcuts.skip]: handleSkip,
      [keyboardShortcuts.undo]: handleUndo,
      ArrowLeft: handlePrevious,
      ArrowRight: handleNext,
    }),
    [
      handleClose,
      handleArchive,
      handleDelete,
      handleSkip,
      handleUndo,
      handlePrevious,
      handleNext,
      keyboardShortcuts,
    ],
  );

  // Handle keyboard navigation
  useShortcut(shortcutMap);

  const previewRef = useRef<HTMLDivElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const ref = previewRef.current;
    const handler = (event: MouseEvent) => {
      if (event.target === event.currentTarget) {
        handleClose();
      }
    };
    if (ref) {
      ref.addEventListener("click", handler);
    }
    return () => {
      if (ref) {
        ref.removeEventListener("click", handler);
      }
    };
  }, [handleClose]);

  if (!archiveDeleteMode.active) {
    return null;
  }

  const progressText = `${archiveDeleteMode.currentIndex + 1} of ${archiveDeleteMode.fileIds.length}`;
  const pendingText =
    pendingArchiveDeleteOperations.length > 0
      ? ` (${pendingArchiveDeleteOperations.length} pending)`
      : "";

  // Calculate counts for confirmation dialog
  const archiveCount = pendingArchiveDeleteOperations.filter(
    (op) => op.operation === "archive",
  ).length;
  const deleteCount = pendingArchiveDeleteOperations.filter(
    (op) => op.operation === "delete",
  ).length;

  return (
    <>
      <FocusTrap
        focusTrapOptions={{
          allowOutsideClick: true,
          initialFocus: () => nextButtonRef.current!,
        }}
      >
        <div className="archive-delete-modal-container">
          {/* Header */}
          <div className="archive-delete-modal-header">
            <div className="archive-delete-modal-progress">
              {progressText}
              {pendingText && (
                <span className="pending-count">{pendingText}</span>
              )}
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="archive-delete-modal-close-button"
            >
              <XMarkIcon className="archive-delete-modal-medium-icon" />
            </button>
          </div>

          {/* Main content */}
          <div className="archive-delete-modal-content">
            {/* Navigation buttons */}
            <button
              type="button"
              onClick={handlePrevious}
              className="archive-delete-modal-nav-button archive-delete-modal-prev-button"
              disabled={!hasPrevious}
            >
              <ChevronLeftIcon className="archive-delete-modal-large-icon" />
            </button>

            <button
              type="button"
              ref={nextButtonRef}
              onClick={handleNext}
              className="archive-delete-modal-nav-button archive-delete-modal-next-button"
              disabled={!hasNext}
            >
              <ChevronRightIcon className="archive-delete-modal-large-icon" />
            </button>

            {/* File content */}
            <div
              className="archive-delete-modal-viewer-container"
              ref={previewRef}
            >
              {currentFileId && (
                <FileViewer
                  fileId={currentFileId}
                  fileData={currentFileData}
                  autoActivate={true}
                  navigateLeft={hasPrevious ? handlePrevious : undefined}
                  navigateRight={hasNext ? handleNext : undefined}
                />
              )}
            </div>
          </div>

          {/* Status indicator */}
          {currentOperation && (
            <div className="archive-delete-modal-status">
              <span
                className={`status-badge status-${currentOperation.operation}`}
              >
                Pending: {currentOperation.operation}
              </span>
            </div>
          )}

          {/* Action buttons */}
          <div className="archive-delete-modal-actions">
            {currentOperation && (
              <PushButton
                onClick={handleUndo}
                variant="secondary"
                disabled={isProcessingArchiveDelete}
                className="archive-delete-modal-undo-button"
              >
                <ArrowUturnLeftIcon className="archive-delete-modal-button-icon" />
                Revert
                <kbd className="shortcut-input-key">
                  {formatKeyForDisplay(keyboardShortcuts.undo)}
                </kbd>
              </PushButton>
            )}
            <PushButton
              onClick={handleArchive}
              variant="primary"
              disabled={isProcessingArchiveDelete}
              className="archive-delete-modal-archive-button"
            >
              <ArchiveBoxIcon className="archive-delete-modal-button-icon" />
              Archive
              <kbd className="shortcut-input-key">
                {formatKeyForDisplay(keyboardShortcuts.archive)}
              </kbd>
            </PushButton>
            <PushButton
              onClick={handleDelete}
              variant="danger"
              disabled={isProcessingArchiveDelete}
              className="archive-delete-modal-delete-button"
            >
              <TrashIcon className="archive-delete-modal-button-icon" />
              Delete
              <kbd className="shortcut-input-key">
                {formatKeyForDisplay(keyboardShortcuts.delete)}
              </kbd>
            </PushButton>
            <PushButton
              onClick={handleSkip}
              variant="secondary"
              disabled={isProcessingArchiveDelete}
              className="archive-delete-modal-skip-button"
            >
              Skip
              <kbd className="shortcut-input-key">
                {formatKeyForDisplay(keyboardShortcuts.skip)}
              </kbd>
            </PushButton>
            {pendingArchiveDeleteOperations.length > 0 && (
              <PushButton
                onClick={handleClose}
                variant="primary"
                disabled={isProcessingArchiveDelete}
                className="archive-delete-modal-apply-all-button"
              >
                <Square3Stack3DIcon className="archive-delete-modal-button-icon" />
                Apply&nbsp;All
              </PushButton>
            )}
          </div>
        </div>
      </FocusTrap>

      {showCloseConfirm && (
        <ConfirmModal
          title="Apply Pending Changes?"
          message={`You have ${pendingArchiveDeleteOperations.length} pending operation(s): ${archiveCount} archive and ${deleteCount} delete. Do you want to apply these changes?`}
          confirmLabel="Apply Changes"
          cancelLabel="Discard All"
          onConfirm={handleExecutePendingOperations}
          onCancel={handleDiscardChanges}
        />
      )}
    </>
  );
};

export default ArchiveDeleteModal;
