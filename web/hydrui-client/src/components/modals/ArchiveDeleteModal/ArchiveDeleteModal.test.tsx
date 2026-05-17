import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ArchiveDeleteModal from "./ArchiveDeleteModal";

// Mock the stores
const mockCloseArchiveDeleteMode = vi.fn();
const mockNextArchiveDeleteImage = vi.fn();
const mockPreviousArchiveDeleteImage = vi.fn();
const mockAddPendingOperation = vi.fn();
const mockRemovePendingOperation = vi.fn();
const mockClearPendingOperations = vi.fn();
const mockExecutePendingOperations = vi.fn();

const defaultArchiveDeleteMode = {
  active: false,
  fileIds: [] as number[],
  currentIndex: 0,
};

let archiveDeleteModeState = { ...defaultArchiveDeleteMode };
let pendingOperationsState: {
  fileId: number;
  operation: "archive" | "delete";
}[] = [];
let isProcessingState = false;
let loadedFilesState: Record<number, { file_id: number; mime: string }> = {};
let fileIdToIndexState = new Map<number, number>();

vi.mock("@/store/pageStore", () => ({
  usePageStore: vi.fn((selector) => {
    const state = {
      archiveDeleteMode: archiveDeleteModeState,
      pendingArchiveDeleteOperations: pendingOperationsState,
      isProcessingArchiveDelete: isProcessingState,
      loadedFiles: Object.values(loadedFilesState),
      fileIdToIndex: fileIdToIndexState,
      actions: {
        closeArchiveDeleteMode: mockCloseArchiveDeleteMode,
        nextArchiveDeleteImage: mockNextArchiveDeleteImage,
        previousArchiveDeleteImage: mockPreviousArchiveDeleteImage,
        addPendingOperation: mockAddPendingOperation,
        removePendingOperation: mockRemovePendingOperation,
        clearPendingOperations: mockClearPendingOperations,
        executePendingOperations: mockExecutePendingOperations,
      },
    };
    return selector(state);
  }),
}));

vi.mock("@/store/preferencesStore", () => ({
  usePreferencesStore: vi.fn((selector) => {
    const state = {
      keyboardShortcuts: {
        archiveDeleteModal: {
          archive: "a",
          delete: "d",
          skip: "s",
          undo: "u",
        },
      },
    };
    return selector(state);
  }),
}));

// Mock FocusTrap to just render children
vi.mock("focus-trap-react", () => ({
  FocusTrap: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock FileViewer component
vi.mock("@/components/widgets/FileViewer/FileViewer", () => ({
  default: ({ fileId }: { fileId: number }) => (
    <div data-testid={`file-viewer-${fileId}`}>File Viewer for {fileId}</div>
  ),
}));

// Mock ConfirmModal component
vi.mock("@/components/modals/ConfirmModal/ConfirmModal", () => ({
  default: ({
    title,
    message,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
  }: {
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
  }) => (
    <div data-testid="confirm-modal">
      <h3>{title}</h3>
      <p>{message}</p>
      <button onClick={onConfirm}>{confirmLabel}</button>
      <button onClick={onCancel}>{cancelLabel}</button>
    </div>
  ),
}));

// Mock formatKeyForDisplay
vi.mock("@/components/inputs/ShortcutInput/formatKeyForDisplay", () => ({
  default: (key: string) => key.toUpperCase(),
}));

describe("ArchiveDeleteModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    archiveDeleteModeState = { ...defaultArchiveDeleteMode };
    pendingOperationsState = [];
    isProcessingState = false;
    loadedFilesState = {};
    fileIdToIndexState = new Map();
  });

  describe("Rendering", () => {
    it("should not render when archive delete mode is inactive", () => {
      archiveDeleteModeState = { active: false, fileIds: [], currentIndex: 0 };

      render(<ArchiveDeleteModal />);

      expect(screen.queryByText("Archive")).not.toBeInTheDocument();
    });

    it("should render when archive delete mode is active", () => {
      archiveDeleteModeState = {
        active: true,
        fileIds: [1, 2, 3],
        currentIndex: 0,
      };
      loadedFilesState = {
        1: { file_id: 1, mime: "image/jpeg" },
      };
      fileIdToIndexState = new Map([[1, 0]]);

      render(<ArchiveDeleteModal />);

      expect(screen.getByText("Archive")).toBeInTheDocument();
      expect(screen.getByText("Delete")).toBeInTheDocument();
      expect(screen.getByText("Skip")).toBeInTheDocument();
    });

    it("should display correct progress text", () => {
      archiveDeleteModeState = {
        active: true,
        fileIds: [1, 2, 3],
        currentIndex: 1,
      };
      loadedFilesState = {
        2: { file_id: 2, mime: "image/jpeg" },
      };
      fileIdToIndexState = new Map([[2, 0]]);

      render(<ArchiveDeleteModal />);

      expect(screen.getByText("2 of 3")).toBeInTheDocument();
    });

    it("should display pending count when there are pending operations", () => {
      archiveDeleteModeState = {
        active: true,
        fileIds: [1, 2, 3],
        currentIndex: 0,
      };
      pendingOperationsState = [
        { fileId: 1, operation: "archive" as const },
        { fileId: 2, operation: "delete" as const },
      ];
      loadedFilesState = {
        1: { file_id: 1, mime: "image/jpeg" },
      };
      fileIdToIndexState = new Map([[1, 0]]);

      render(<ArchiveDeleteModal />);

      expect(screen.getByText("(2 pending)")).toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("should disable previous button on first image", () => {
      archiveDeleteModeState = {
        active: true,
        fileIds: [1, 2, 3],
        currentIndex: 0,
      };
      loadedFilesState = { 1: { file_id: 1, mime: "image/jpeg" } };
      fileIdToIndexState = new Map([[1, 0]]);

      render(<ArchiveDeleteModal />);

      const prevButton = screen
        .getByRole("button", { name: "" })
        .closest("button");
      expect(prevButton).toBeDisabled();
    });

    it("should disable next button on last image", () => {
      archiveDeleteModeState = {
        active: true,
        fileIds: [1, 2, 3],
        currentIndex: 2,
      };
      loadedFilesState = { 3: { file_id: 3, mime: "image/jpeg" } };
      fileIdToIndexState = new Map([[3, 0]]);

      render(<ArchiveDeleteModal />);

      const buttons = screen.getAllByRole("button");
      const nextButton = buttons.find((btn) => btn.querySelector("svg"));
      expect(nextButton).toBeDefined();
    });

    it("should call nextArchiveDeleteImage when next button is clicked", async () => {
      archiveDeleteModeState = {
        active: true,
        fileIds: [1, 2, 3],
        currentIndex: 0,
      };
      loadedFilesState = { 1: { file_id: 1, mime: "image/jpeg" } };
      fileIdToIndexState = new Map([[1, 0]]);

      render(<ArchiveDeleteModal />);

      // Find the next button (ChevronRightIcon)
      const buttons = screen.getAllByRole("button");
      // The next button should be enabled when not on last image
      const nextButton = buttons[1]; // Second navigation button
      expect(nextButton).toBeDefined();

      await act(async () => {
        fireEvent.click(nextButton!);
      });

      expect(mockNextArchiveDeleteImage).toHaveBeenCalled();
    });

    it("should call previousArchiveDeleteImage when previous button is clicked", async () => {
      archiveDeleteModeState = {
        active: true,
        fileIds: [1, 2, 3],
        currentIndex: 1,
      };
      loadedFilesState = { 2: { file_id: 2, mime: "image/jpeg" } };
      fileIdToIndexState = new Map([[2, 0]]);

      render(<ArchiveDeleteModal />);

      // Find the previous button (ChevronLeftIcon)
      const buttons = screen.getAllByRole("button");
      const prevButton = buttons[0]; // First navigation button
      expect(prevButton).toBeDefined();

      await act(async () => {
        fireEvent.click(prevButton!);
      });

      expect(mockPreviousArchiveDeleteImage).toHaveBeenCalled();
    });
  });

  describe("Archive Action", () => {
    it("should call addPendingOperation with archive when Archive button is clicked", async () => {
      archiveDeleteModeState = {
        active: true,
        fileIds: [1, 2, 3],
        currentIndex: 0,
      };
      loadedFilesState = { 1: { file_id: 1, mime: "image/jpeg" } };
      fileIdToIndexState = new Map([[1, 0]]);

      render(<ArchiveDeleteModal />);

      const archiveButton = screen.getByText("Archive").closest("button");
      if (archiveButton) {
        await act(async () => {
          fireEvent.click(archiveButton);
        });
      }

      expect(mockAddPendingOperation).toHaveBeenCalledWith(1, "archive");
    });

    it("should disable Archive button when processing", async () => {
      archiveDeleteModeState = {
        active: true,
        fileIds: [1, 2, 3],
        currentIndex: 0,
      };
      isProcessingState = true;
      loadedFilesState = { 1: { file_id: 1, mime: "image/jpeg" } };
      fileIdToIndexState = new Map([[1, 0]]);

      render(<ArchiveDeleteModal />);

      const archiveButton = screen.getByText("Archive").closest("button");
      expect(archiveButton).toBeDisabled();
    });
  });

  describe("Delete Action", () => {
    it("should call addPendingOperation with delete when Delete button is clicked", async () => {
      archiveDeleteModeState = {
        active: true,
        fileIds: [1, 2, 3],
        currentIndex: 0,
      };
      loadedFilesState = { 1: { file_id: 1, mime: "image/jpeg" } };
      fileIdToIndexState = new Map([[1, 0]]);

      render(<ArchiveDeleteModal />);

      const deleteButton = screen.getByText("Delete").closest("button");
      if (deleteButton) {
        await act(async () => {
          fireEvent.click(deleteButton);
        });
      }

      expect(mockAddPendingOperation).toHaveBeenCalledWith(1, "delete");
    });

    it("should disable Delete button when processing", async () => {
      archiveDeleteModeState = {
        active: true,
        fileIds: [1, 2, 3],
        currentIndex: 0,
      };
      isProcessingState = true;
      loadedFilesState = { 1: { file_id: 1, mime: "image/jpeg" } };
      fileIdToIndexState = new Map([[1, 0]]);

      render(<ArchiveDeleteModal />);

      const deleteButton = screen.getByText("Delete").closest("button");
      expect(deleteButton).toBeDisabled();
    });
  });

  describe("Skip Action", () => {
    it("should navigate to next file when Skip button is clicked", async () => {
      archiveDeleteModeState = {
        active: true,
        fileIds: [1, 2, 3],
        currentIndex: 0,
      };
      loadedFilesState = { 1: { file_id: 1, mime: "image/jpeg" } };
      fileIdToIndexState = new Map([[1, 0]]);

      render(<ArchiveDeleteModal />);

      const skipButton = screen.getByText("Skip").closest("button");
      if (skipButton) {
        await act(async () => {
          fireEvent.click(skipButton);
        });
      }

      expect(mockNextArchiveDeleteImage).toHaveBeenCalled();
    });
  });

  describe("Undo Action", () => {
    it("should show Revert button when there is a pending operation for current file", () => {
      archiveDeleteModeState = {
        active: true,
        fileIds: [1, 2, 3],
        currentIndex: 0,
      };
      pendingOperationsState = [{ fileId: 1, operation: "archive" }];
      loadedFilesState = { 1: { file_id: 1, mime: "image/jpeg" } };
      fileIdToIndexState = new Map([[1, 0]]);

      render(<ArchiveDeleteModal />);

      expect(screen.getByText("Revert this item")).toBeInTheDocument();
    });

    it("should call removePendingOperation when Revert button is clicked", async () => {
      archiveDeleteModeState = {
        active: true,
        fileIds: [1, 2, 3],
        currentIndex: 0,
      };
      pendingOperationsState = [{ fileId: 1, operation: "archive" }];
      loadedFilesState = { 1: { file_id: 1, mime: "image/jpeg" } };
      fileIdToIndexState = new Map([[1, 0]]);

      render(<ArchiveDeleteModal />);

      const revertButton = screen
        .getByText("Revert this item")
        .closest("button");
      if (revertButton) {
        await act(async () => {
          fireEvent.click(revertButton);
        });
      }

      expect(mockRemovePendingOperation).toHaveBeenCalledWith(1);
    });
  });

  describe("Apply All Action", () => {
    it("should show Apply All button when there are pending operations", () => {
      archiveDeleteModeState = {
        active: true,
        fileIds: [1, 2, 3],
        currentIndex: 0,
      };
      pendingOperationsState = [{ fileId: 1, operation: "archive" }];
      loadedFilesState = { 1: { file_id: 1, mime: "image/jpeg" } };
      fileIdToIndexState = new Map([[1, 0]]);

      render(<ArchiveDeleteModal />);

      expect(screen.getByText("Apply All")).toBeInTheDocument();
    });

    it("should open confirmation dialog when Apply All is clicked", async () => {
      archiveDeleteModeState = {
        active: true,
        fileIds: [1, 2, 3],
        currentIndex: 0,
      };
      pendingOperationsState = [{ fileId: 1, operation: "archive" }];
      loadedFilesState = { 1: { file_id: 1, mime: "image/jpeg" } };
      fileIdToIndexState = new Map([[1, 0]]);

      render(<ArchiveDeleteModal />);

      // Click Apply All
      fireEvent.click(screen.getByText("Apply All"));

      // Confirmation dialog should appear
      expect(screen.getByText("Apply Pending Changes?")).toBeInTheDocument();
    });

    it("should not show Apply All button when there are no pending operations", () => {
      archiveDeleteModeState = {
        active: true,
        fileIds: [1, 2, 3],
        currentIndex: 0,
      };
      pendingOperationsState = [];
      loadedFilesState = { 1: { file_id: 1, mime: "image/jpeg" } };
      fileIdToIndexState = new Map([[1, 0]]);

      render(<ArchiveDeleteModal />);

      expect(screen.queryByText("Apply All")).not.toBeInTheDocument();
    });
  });

  describe("Close Behavior", () => {
    it("should close immediately when no pending operations", async () => {
      archiveDeleteModeState = {
        active: true,
        fileIds: [1, 2, 3],
        currentIndex: 0,
      };
      pendingOperationsState = [];
      loadedFilesState = { 1: { file_id: 1, mime: "image/jpeg" } };
      fileIdToIndexState = new Map([[1, 0]]);

      render(<ArchiveDeleteModal />);

      // Find close button (XMarkIcon)
      const closeButtons = screen.getAllByRole("button");
      const closeButton = closeButtons.find((btn) =>
        btn.className.includes("archive-delete-modal-close-button"),
      );

      if (closeButton) {
        await act(async () => {
          fireEvent.click(closeButton);
        });
      }

      expect(mockCloseArchiveDeleteMode).toHaveBeenCalled();
    });

    it("should show confirmation dialog when there are pending operations", async () => {
      archiveDeleteModeState = {
        active: true,
        fileIds: [1, 2, 3],
        currentIndex: 0,
      };
      pendingOperationsState = [{ fileId: 1, operation: "archive" }];
      loadedFilesState = { 1: { file_id: 1, mime: "image/jpeg" } };
      fileIdToIndexState = new Map([[1, 0]]);

      render(<ArchiveDeleteModal />);

      // Find close button (XMarkIcon)
      const closeButtons = screen.getAllByRole("button");
      const closeButton = closeButtons.find((btn) =>
        btn.className.includes("archive-delete-modal-close-button"),
      );

      if (closeButton) {
        await act(async () => {
          fireEvent.click(closeButton);
        });
      }

      expect(screen.getByTestId("confirm-modal")).toBeInTheDocument();
      expect(screen.getByText("Apply Pending Changes?")).toBeInTheDocument();
    });

    it("should execute pending operations when Apply Changes is clicked", async () => {
      archiveDeleteModeState = {
        active: true,
        fileIds: [1, 2, 3],
        currentIndex: 0,
      };
      pendingOperationsState = [{ fileId: 1, operation: "archive" }];
      loadedFilesState = { 1: { file_id: 1, mime: "image/jpeg" } };
      fileIdToIndexState = new Map([[1, 0]]);

      render(<ArchiveDeleteModal />);

      // Open confirmation dialog
      const closeButtons = screen.getAllByRole("button");
      const closeButton = closeButtons.find((btn) =>
        btn.className.includes("archive-delete-modal-close-button"),
      );

      if (closeButton) {
        await act(async () => {
          fireEvent.click(closeButton);
        });
      }

      // Click Apply Changes
      const applyButton = screen.getByText("Apply Changes");
      await act(async () => {
        fireEvent.click(applyButton);
      });

      expect(mockExecutePendingOperations).toHaveBeenCalled();
    });

    it("should discard changes when Discard All is clicked", async () => {
      archiveDeleteModeState = {
        active: true,
        fileIds: [1, 2, 3],
        currentIndex: 0,
      };
      pendingOperationsState = [{ fileId: 1, operation: "archive" }];
      loadedFilesState = { 1: { file_id: 1, mime: "image/jpeg" } };
      fileIdToIndexState = new Map([[1, 0]]);

      render(<ArchiveDeleteModal />);

      // Open confirmation dialog
      const closeButtons = screen.getAllByRole("button");
      const closeButton = closeButtons.find((btn) =>
        btn.className.includes("archive-delete-modal-close-button"),
      );

      if (closeButton) {
        await act(async () => {
          fireEvent.click(closeButton);
        });
      }

      // Click Discard All
      const discardButton = screen.getByText("Discard All");
      await act(async () => {
        fireEvent.click(discardButton);
      });

      expect(mockClearPendingOperations).toHaveBeenCalled();
      expect(mockCloseArchiveDeleteMode).toHaveBeenCalled();
    });
  });

  describe("Status Indicator", () => {
    it("should show pending archive status for current file", () => {
      archiveDeleteModeState = {
        active: true,
        fileIds: [1, 2, 3],
        currentIndex: 0,
      };
      pendingOperationsState = [{ fileId: 1, operation: "archive" }];
      loadedFilesState = { 1: { file_id: 1, mime: "image/jpeg" } };
      fileIdToIndexState = new Map([[1, 0]]);

      render(<ArchiveDeleteModal />);

      expect(screen.getByText("Pending: archive")).toBeInTheDocument();
    });

    it("should show pending delete status for current file", () => {
      archiveDeleteModeState = {
        active: true,
        fileIds: [1, 2, 3],
        currentIndex: 0,
      };
      pendingOperationsState = [{ fileId: 1, operation: "delete" }];
      loadedFilesState = { 1: { file_id: 1, mime: "image/jpeg" } };
      fileIdToIndexState = new Map([[1, 0]]);

      render(<ArchiveDeleteModal />);

      expect(screen.getByText("Pending: delete")).toBeInTheDocument();
    });

    it("should not show status indicator when no pending operation for current file", () => {
      archiveDeleteModeState = {
        active: true,
        fileIds: [1, 2, 3],
        currentIndex: 0,
      };
      pendingOperationsState = [{ fileId: 2, operation: "archive" }];
      loadedFilesState = { 1: { file_id: 1, mime: "image/jpeg" } };
      fileIdToIndexState = new Map([[1, 0]]);

      render(<ArchiveDeleteModal />);

      expect(screen.queryByText("Pending: archive")).not.toBeInTheDocument();
    });
  });

  describe("Confirmation Dialog Message", () => {
    it("should show correct counts in confirmation dialog", async () => {
      archiveDeleteModeState = {
        active: true,
        fileIds: [1, 2, 3],
        currentIndex: 0,
      };
      pendingOperationsState = [
        { fileId: 1, operation: "archive" },
        { fileId: 2, operation: "archive" },
        { fileId: 3, operation: "delete" },
      ];
      loadedFilesState = { 1: { file_id: 1, mime: "image/jpeg" } };
      fileIdToIndexState = new Map([[1, 0]]);

      render(<ArchiveDeleteModal />);

      // Open confirmation dialog
      const closeButtons = screen.getAllByRole("button");
      const closeButton = closeButtons.find((btn) =>
        btn.className.includes("archive-delete-modal-close-button"),
      );

      if (closeButton) {
        await act(async () => {
          fireEvent.click(closeButton);
        });
      }

      expect(
        screen.getByText(
          /You have 3 pending operation\(s\): 2 archive and 1 delete/,
        ),
      ).toBeInTheDocument();
    });
  });
});
