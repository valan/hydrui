import React, { Suspense, lazy, useCallback, useEffect, useState } from "react";

import { FileMetadata } from "@/api/types";
import { client } from "@/store/apiStore";
import { usePreferencesStore } from "@/store/preferencesStore";

import "./index.css";

const OGVViewer = lazy(() => import("./OGVViewer"));
const HLSViewer = lazy(() => import("./HLSViewer"));

interface VideoViewerProps {
  fileId: number;
  fileData: FileMetadata;
  autoPlay?: boolean;
  loop?: boolean;
}

const VideoViewer: React.FC<VideoViewerProps> = ({
  fileId,
  fileData,
  autoPlay = true,
  loop = true,
}) => {
  const fileUrl = client.getFileUrl(fileId);
  const [canPlay, setCanPlay] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const { videoTranscoder } = usePreferencesStore();

  useEffect(() => {
    if (
      !fileData.mime ||
      (fileData.mime !== "video/ogg" && fileData.mime !== "video/webm")
    ) {
      setCanPlay(false);
      setUseFallback(false);
      return;
    }
    const video = document.createElement("video");
    if (video.canPlayType(fileData.mime) === "") {
      setCanPlay(false);
      setUseFallback(true);
    } else {
      setCanPlay(true);
      setUseFallback(false);
    }
  }, [fileData.mime]);

  const handleCanPlay = useCallback(() => {
    setCanPlay(true);
  }, []);

  const handleError = useCallback(
    (event: React.SyntheticEvent<HTMLVideoElement>) => {
      if (!canPlay) {
        setUseFallback(true);
      }
      if (
        event.currentTarget.error?.code ===
        MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
      ) {
        setUseFallback(true);
      }
    },
    [canPlay],
  );

  if (useFallback && fileData.size) {
    if (videoTranscoder === "ogv") {
      return (
        <Suspense fallback={<div>Loading OGV Viewer...</div>}>
          <OGVViewer
            fileUrl={fileUrl}
            fileSize={fileData.size}
            autoPlay={autoPlay}
            loop={loop}
          />
        </Suspense>
      );
    } else {
      const hlsUrl = new URL(fileUrl, window.location.origin);
      hlsUrl.searchParams.set("transcode", "hls");
      return (
        <Suspense fallback={<div>Starting HLS Transcode...</div>}>
          <HLSViewer
            fileUrl={hlsUrl.toString()}
            autoPlay={autoPlay}
            loop={loop}
          />
        </Suspense>
      );
    }
  }
  return (
    <video
      src={fileUrl}
      controls
      className="video-viewer"
      autoPlay={autoPlay}
      loop={loop}
      preload="auto"
      onCanPlay={handleCanPlay}
      onError={handleError}
      crossOrigin="anonymous"
    />
  );
};

export default VideoViewer;
