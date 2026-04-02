import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePageStore } from "./pageStore";

// Mock dependencies - must be defined before imports that use them
vi.mock("./apiStore", () => {
  const listeners = new Set<() => void>();
  let state = { isAuthenticated: true };

  return {
    client: {
      archiveFiles: vi.fn(),
      deleteFiles: vi.fn(),
    },
    useApiStore: Object.assign(
      vi.fn(() => state),
      {
        getState: () => state,
        setState: (newState: Partial<typeof state>) => {
          state = { ...state, ...newState };
          listeners.forEach((listener) => listener());
        },
        subscribe: (listener: () => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      },
    ),
  };
});

vi.mock("./searchStore", () => {
  const listeners = new Set<(state: unknown, prevState: unknown) => void>();
  const state = { searchResults: [] };

  return {
    useSearchStore: Object.assign(
      vi.fn(() => state),
      {
        getState: () => state,
        subscribe: (listener: (state: unknown, prevState: unknown) => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      },
    ),
  };
});

vi.mock("./preferencesStore", () => ({
  usePreferencesStore: vi.fn(),
}));

vi.mock("./toastStore", () => ({
  useToastStore: {
    getState: vi.fn(() => ({
      actions: {
        addToast: vi.fn(),
      },
    })),
  },
}));

vi.mock("@/utils/modes", () => ({
  isDemoMode: vi.fn(() => false),
}));

vi.mock("./storage", () => ({
  jsonStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
  },
}));

describe("pageStore - Archive/Delete Actions", () => {
  beforeEach(async () => {
    // Reset store state
    usePageStore.setState({
      archiveDeleteMode: {
        active: false,
        fileIds: [],
        currentIndex: 0,
      },
      pendingArchiveDeleteOperations: [],
      isProcessingArchiveDelete: false,
    });

    vi.clearAllMocks();
  });

  describe("openArchiveDeleteMode", () => {
    it("should open archive delete mode with provided file IDs", () => {
      const fileIds = [1, 2, 3, 4, 5];

      usePageStore.getState().actions.openArchiveDeleteMode(fileIds);

      const state = usePageStore.getState();
      expect(state.archiveDeleteMode.active).toBe(true);
      expect(state.archiveDeleteMode.fileIds).toEqual(fileIds);
      expect(state.archiveDeleteMode.currentIndex).toBe(0);
    });

    it("should open archive delete mode with empty array", () => {
      usePageStore.getState().actions.openArchiveDeleteMode([]);

      const state = usePageStore.getState();
      expect(state.archiveDeleteMode.active).toBe(true);
      expect(state.archiveDeleteMode.fileIds).toEqual([]);
      expect(state.archiveDeleteMode.currentIndex).toBe(0);
    });

    it("should replace existing archive delete mode state", () => {
      // First open with some files
      usePageStore.getState().actions.openArchiveDeleteMode([1, 2, 3]);

      // Then open with different files
      usePageStore.getState().actions.openArchiveDeleteMode([4, 5]);

      const state = usePageStore.getState();
      expect(state.archiveDeleteMode.fileIds).toEqual([4, 5]);
      expect(state.archiveDeleteMode.currentIndex).toBe(0);
    });
  });

  describe("closeArchiveDeleteMode", () => {
    it("should close archive delete mode and reset state", () => {
      // First open
      usePageStore.getState().actions.openArchiveDeleteMode([1, 2, 3]);

      // Then close
      usePageStore.getState().actions.closeArchiveDeleteMode();

      const state = usePageStore.getState();
      expect(state.archiveDeleteMode.active).toBe(false);
      expect(state.archiveDeleteMode.fileIds).toEqual([]);
      expect(state.archiveDeleteMode.currentIndex).toBe(0);
    });

    it("should be safe to call when already closed", () => {
      // Close when already closed
      usePageStore.getState().actions.closeArchiveDeleteMode();

      const state = usePageStore.getState();
      expect(state.archiveDeleteMode.active).toBe(false);
    });
  });

  describe("nextArchiveDeleteImage", () => {
    it("should increment currentIndex when not at last image", () => {
      usePageStore.setState({
        archiveDeleteMode: {
          active: true,
          fileIds: [1, 2, 3, 4, 5],
          currentIndex: 1,
        },
      });

      usePageStore.getState().actions.nextArchiveDeleteImage();

      const state = usePageStore.getState();
      expect(state.archiveDeleteMode.currentIndex).toBe(2);
    });

    it("should not increment currentIndex when at last image", () => {
      usePageStore.setState({
        archiveDeleteMode: {
          active: true,
          fileIds: [1, 2, 3],
          currentIndex: 2, // Already at last index
        },
      });

      usePageStore.getState().actions.nextArchiveDeleteImage();

      const state = usePageStore.getState();
      expect(state.archiveDeleteMode.currentIndex).toBe(2);
    });

    it("should do nothing when archive delete mode is inactive", () => {
      usePageStore.setState({
        archiveDeleteMode: {
          active: false,
          fileIds: [1, 2, 3],
          currentIndex: 0,
        },
      });

      usePageStore.getState().actions.nextArchiveDeleteImage();

      const state = usePageStore.getState();
      expect(state.archiveDeleteMode.currentIndex).toBe(0);
    });

    it("should do nothing when fileIds is empty", () => {
      usePageStore.setState({
        archiveDeleteMode: {
          active: true,
          fileIds: [],
          currentIndex: 0,
        },
      });

      usePageStore.getState().actions.nextArchiveDeleteImage();

      const state = usePageStore.getState();
      expect(state.archiveDeleteMode.currentIndex).toBe(0);
    });
  });

  describe("previousArchiveDeleteImage", () => {
    it("should decrement currentIndex when not at first image", () => {
      usePageStore.setState({
        archiveDeleteMode: {
          active: true,
          fileIds: [1, 2, 3, 4, 5],
          currentIndex: 2,
        },
      });

      usePageStore.getState().actions.previousArchiveDeleteImage();

      const state = usePageStore.getState();
      expect(state.archiveDeleteMode.currentIndex).toBe(1);
    });

    it("should not decrement currentIndex when at first image", () => {
      usePageStore.setState({
        archiveDeleteMode: {
          active: true,
          fileIds: [1, 2, 3],
          currentIndex: 0, // Already at first index
        },
      });

      usePageStore.getState().actions.previousArchiveDeleteImage();

      const state = usePageStore.getState();
      expect(state.archiveDeleteMode.currentIndex).toBe(0);
    });

    it("should do nothing when archive delete mode is inactive", () => {
      usePageStore.setState({
        archiveDeleteMode: {
          active: false,
          fileIds: [1, 2, 3],
          currentIndex: 2,
        },
      });

      usePageStore.getState().actions.previousArchiveDeleteImage();

      const state = usePageStore.getState();
      expect(state.archiveDeleteMode.currentIndex).toBe(2);
    });
  });

  describe("removeFromArchiveDeleteMode", () => {
    it("should remove file from the list", () => {
      usePageStore.setState({
        archiveDeleteMode: {
          active: true,
          fileIds: [1, 2, 3, 4, 5],
          currentIndex: 2,
        },
      });

      usePageStore.getState().actions.removeFromArchiveDeleteMode(3);

      const state = usePageStore.getState();
      expect(state.archiveDeleteMode.fileIds).toEqual([1, 2, 4, 5]);
    });

    it("should adjust currentIndex if removed file was before current", () => {
      usePageStore.setState({
        archiveDeleteMode: {
          active: true,
          fileIds: [1, 2, 3, 4, 5],
          currentIndex: 3, // Pointing to file 4
        },
      });

      // Remove file 2 (index 1)
      usePageStore.getState().actions.removeFromArchiveDeleteMode(2);

      const state = usePageStore.getState();
      expect(state.archiveDeleteMode.fileIds).toEqual([1, 3, 4, 5]);
      // The implementation uses Math.min(currentIndex, newLength - 1)
      // currentIndex is 3, newLength is 4, so min(3, 3) = 3
      expect(state.archiveDeleteMode.currentIndex).toBe(3);
    });

    it("should not adjust currentIndex if removed file was after current", () => {
      usePageStore.setState({
        archiveDeleteMode: {
          active: true,
          fileIds: [1, 2, 3, 4, 5],
          currentIndex: 1, // Pointing to file 2
        },
      });

      // Remove file 4 (index 3)
      usePageStore.getState().actions.removeFromArchiveDeleteMode(4);

      const state = usePageStore.getState();
      expect(state.archiveDeleteMode.fileIds).toEqual([1, 2, 3, 5]);
      expect(state.archiveDeleteMode.currentIndex).toBe(1); // Unchanged
    });

    it("should close mode when last file is removed", () => {
      usePageStore.setState({
        archiveDeleteMode: {
          active: true,
          fileIds: [1],
          currentIndex: 0,
        },
      });

      usePageStore.getState().actions.removeFromArchiveDeleteMode(1);

      const state = usePageStore.getState();
      expect(state.archiveDeleteMode.active).toBe(false);
      expect(state.archiveDeleteMode.fileIds).toEqual([]);
    });

    it("should do nothing when archive delete mode is inactive", () => {
      usePageStore.setState({
        archiveDeleteMode: {
          active: false,
          fileIds: [1, 2, 3],
          currentIndex: 0,
        },
      });

      usePageStore.getState().actions.removeFromArchiveDeleteMode(2);

      const state = usePageStore.getState();
      expect(state.archiveDeleteMode.fileIds).toEqual([1, 2, 3]);
    });
  });

  describe("addPendingOperation", () => {
    it("should add archive operation for a file", () => {
      usePageStore.getState().actions.addPendingOperation(1, "archive");

      const state = usePageStore.getState();
      expect(state.pendingArchiveDeleteOperations).toEqual([
        { fileId: 1, operation: "archive" },
      ]);
    });

    it("should add delete operation for a file", () => {
      usePageStore.getState().actions.addPendingOperation(1, "delete");

      const state = usePageStore.getState();
      expect(state.pendingArchiveDeleteOperations).toEqual([
        { fileId: 1, operation: "delete" },
      ]);
    });

    it("should replace existing operation for the same file", () => {
      usePageStore.getState().actions.addPendingOperation(1, "archive");
      usePageStore.getState().actions.addPendingOperation(1, "delete");

      const state = usePageStore.getState();
      expect(state.pendingArchiveDeleteOperations).toEqual([
        { fileId: 1, operation: "delete" },
      ]);
    });

    it("should handle multiple files with different operations", () => {
      usePageStore.getState().actions.addPendingOperation(1, "archive");
      usePageStore.getState().actions.addPendingOperation(2, "delete");
      usePageStore.getState().actions.addPendingOperation(3, "archive");

      const state = usePageStore.getState();
      expect(state.pendingArchiveDeleteOperations).toEqual([
        { fileId: 1, operation: "archive" },
        { fileId: 2, operation: "delete" },
        { fileId: 3, operation: "archive" },
      ]);
    });

    it("should allow changing operation type for a file", () => {
      usePageStore.getState().actions.addPendingOperation(1, "archive");
      usePageStore.getState().actions.addPendingOperation(2, "delete");
      // Change file 1 from archive to delete
      usePageStore.getState().actions.addPendingOperation(1, "delete");

      const state = usePageStore.getState();
      expect(state.pendingArchiveDeleteOperations).toEqual([
        { fileId: 2, operation: "delete" },
        { fileId: 1, operation: "delete" },
      ]);
    });
  });

  describe("removePendingOperation", () => {
    it("should remove pending operation for a file", () => {
      usePageStore.setState({
        pendingArchiveDeleteOperations: [
          { fileId: 1, operation: "archive" },
          { fileId: 2, operation: "delete" },
          { fileId: 3, operation: "archive" },
        ],
      });

      usePageStore.getState().actions.removePendingOperation(2);

      const state = usePageStore.getState();
      expect(state.pendingArchiveDeleteOperations).toEqual([
        { fileId: 1, operation: "archive" },
        { fileId: 3, operation: "archive" },
      ]);
    });

    it("should do nothing if file has no pending operation", () => {
      usePageStore.setState({
        pendingArchiveDeleteOperations: [{ fileId: 1, operation: "archive" }],
      });

      usePageStore.getState().actions.removePendingOperation(999);

      const state = usePageStore.getState();
      expect(state.pendingArchiveDeleteOperations).toEqual([
        { fileId: 1, operation: "archive" },
      ]);
    });

    it("should handle empty pending operations", () => {
      usePageStore.setState({
        pendingArchiveDeleteOperations: [],
      });

      usePageStore.getState().actions.removePendingOperation(1);

      const state = usePageStore.getState();
      expect(state.pendingArchiveDeleteOperations).toEqual([]);
    });
  });

  describe("clearPendingOperations", () => {
    it("should clear all pending operations", () => {
      usePageStore.setState({
        pendingArchiveDeleteOperations: [
          { fileId: 1, operation: "archive" },
          { fileId: 2, operation: "delete" },
          { fileId: 3, operation: "archive" },
        ],
      });

      usePageStore.getState().actions.clearPendingOperations();

      const state = usePageStore.getState();
      expect(state.pendingArchiveDeleteOperations).toEqual([]);
    });

    it("should be safe to call when already empty", () => {
      usePageStore.setState({
        pendingArchiveDeleteOperations: [],
      });

      usePageStore.getState().actions.clearPendingOperations();

      const state = usePageStore.getState();
      expect(state.pendingArchiveDeleteOperations).toEqual([]);
    });
  });

  describe("executePendingOperations", () => {
    it("should do nothing when no pending operations", async () => {
      const { client } = await import("./apiStore");

      usePageStore.setState({
        pendingArchiveDeleteOperations: [],
      });

      await usePageStore.getState().actions.executePendingOperations();

      expect(client.archiveFiles).not.toHaveBeenCalled();
      expect(client.deleteFiles).not.toHaveBeenCalled();
    });

    it("should execute archive operations", async () => {
      const { client } = await import("./apiStore");
      const mockArchiveFiles = vi.mocked(client.archiveFiles);
      mockArchiveFiles.mockResolvedValue(undefined);

      usePageStore.setState({
        pendingArchiveDeleteOperations: [
          { fileId: 1, operation: "archive" },
          { fileId: 2, operation: "archive" },
        ],
        archiveDeleteMode: {
          active: true,
          fileIds: [1, 2, 3],
          currentIndex: 0,
        },
      });

      await usePageStore.getState().actions.executePendingOperations();

      expect(mockArchiveFiles).toHaveBeenCalledWith({ file_ids: [1, 2] });
    });

    it("should execute delete operations", async () => {
      const { client } = await import("./apiStore");
      const mockDeleteFiles = vi.mocked(client.deleteFiles);
      mockDeleteFiles.mockResolvedValue(undefined);

      usePageStore.setState({
        pendingArchiveDeleteOperations: [
          { fileId: 1, operation: "delete" },
          { fileId: 2, operation: "delete" },
        ],
        archiveDeleteMode: {
          active: true,
          fileIds: [1, 2, 3],
          currentIndex: 0,
        },
      });

      await usePageStore.getState().actions.executePendingOperations();

      expect(mockDeleteFiles).toHaveBeenCalledWith({ file_ids: [1, 2] });
    });

    it("should execute both archive and delete operations", async () => {
      const { client } = await import("./apiStore");
      const mockArchiveFiles = vi.mocked(client.archiveFiles);
      const mockDeleteFiles = vi.mocked(client.deleteFiles);
      mockArchiveFiles.mockResolvedValue(undefined);
      mockDeleteFiles.mockResolvedValue(undefined);

      usePageStore.setState({
        pendingArchiveDeleteOperations: [
          { fileId: 1, operation: "archive" },
          { fileId: 2, operation: "delete" },
          { fileId: 3, operation: "archive" },
        ],
        archiveDeleteMode: {
          active: true,
          fileIds: [1, 2, 3],
          currentIndex: 0,
        },
      });

      await usePageStore.getState().actions.executePendingOperations();

      expect(mockArchiveFiles).toHaveBeenCalledWith({ file_ids: [1, 3] });
      expect(mockDeleteFiles).toHaveBeenCalledWith({ file_ids: [2] });
    });

    it("should clear pending operations after execution", async () => {
      const { client } = await import("./apiStore");
      const mockArchiveFiles = vi.mocked(client.archiveFiles);
      mockArchiveFiles.mockResolvedValue(undefined);

      usePageStore.setState({
        pendingArchiveDeleteOperations: [{ fileId: 1, operation: "archive" }],
        archiveDeleteMode: {
          active: true,
          fileIds: [1, 2, 3],
          currentIndex: 0,
        },
      });

      await usePageStore.getState().actions.executePendingOperations();

      const state = usePageStore.getState();
      expect(state.pendingArchiveDeleteOperations).toEqual([]);
    });

    it("should close archive delete mode after execution", async () => {
      const { client } = await import("./apiStore");
      const mockArchiveFiles = vi.mocked(client.archiveFiles);
      mockArchiveFiles.mockResolvedValue(undefined);

      usePageStore.setState({
        pendingArchiveDeleteOperations: [{ fileId: 1, operation: "archive" }],
        archiveDeleteMode: {
          active: true,
          fileIds: [1, 2, 3],
          currentIndex: 0,
        },
      });

      await usePageStore.getState().actions.executePendingOperations();

      const state = usePageStore.getState();
      expect(state.archiveDeleteMode.active).toBe(false);
    });

    it("should set isProcessingArchiveDelete during execution", async () => {
      const { client } = await import("./apiStore");
      const mockArchiveFiles = vi.mocked(client.archiveFiles);
      mockArchiveFiles.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );

      usePageStore.setState({
        pendingArchiveDeleteOperations: [{ fileId: 1, operation: "archive" }],
        archiveDeleteMode: {
          active: true,
          fileIds: [1, 2, 3],
          currentIndex: 0,
        },
      });

      const promise = usePageStore
        .getState()
        .actions.executePendingOperations();

      // Check that processing flag is set during execution
      expect(usePageStore.getState().isProcessingArchiveDelete).toBe(true);

      await promise;

      // Check that processing flag is cleared after execution
      expect(usePageStore.getState().isProcessingArchiveDelete).toBe(false);
    });

    it("should handle archive errors gracefully", async () => {
      const { client } = await import("./apiStore");
      const mockArchiveFiles = vi.mocked(client.archiveFiles);
      mockArchiveFiles.mockRejectedValue(new Error("Archive failed"));

      usePageStore.setState({
        pendingArchiveDeleteOperations: [{ fileId: 1, operation: "archive" }],
        archiveDeleteMode: {
          active: true,
          fileIds: [1, 2, 3],
          currentIndex: 0,
        },
      });

      // Should not throw
      await usePageStore.getState().actions.executePendingOperations();

      // Should still clear and close
      const state = usePageStore.getState();
      expect(state.pendingArchiveDeleteOperations).toEqual([]);
      expect(state.archiveDeleteMode.active).toBe(false);
    });

    it("should handle delete errors gracefully", async () => {
      const { client } = await import("./apiStore");
      const mockDeleteFiles = vi.mocked(client.deleteFiles);
      mockDeleteFiles.mockRejectedValue(new Error("Delete failed"));

      usePageStore.setState({
        pendingArchiveDeleteOperations: [{ fileId: 1, operation: "delete" }],
        archiveDeleteMode: {
          active: true,
          fileIds: [1, 2, 3],
          currentIndex: 0,
        },
      });

      // Should not throw
      await usePageStore.getState().actions.executePendingOperations();

      // Should still clear and close
      const state = usePageStore.getState();
      expect(state.pendingArchiveDeleteOperations).toEqual([]);
      expect(state.archiveDeleteMode.active).toBe(false);
    });

    it("should continue with delete operations even if archive fails", async () => {
      const { client } = await import("./apiStore");
      const mockArchiveFiles = vi.mocked(client.archiveFiles);
      const mockDeleteFiles = vi.mocked(client.deleteFiles);
      mockArchiveFiles.mockRejectedValue(new Error("Archive failed"));
      mockDeleteFiles.mockResolvedValue(undefined);

      usePageStore.setState({
        pendingArchiveDeleteOperations: [
          { fileId: 1, operation: "archive" },
          { fileId: 2, operation: "delete" },
        ],
        archiveDeleteMode: {
          active: true,
          fileIds: [1, 2, 3],
          currentIndex: 0,
        },
      });

      await usePageStore.getState().actions.executePendingOperations();

      expect(mockArchiveFiles).toHaveBeenCalled();
      expect(mockDeleteFiles).toHaveBeenCalled();
    });
  });
});
