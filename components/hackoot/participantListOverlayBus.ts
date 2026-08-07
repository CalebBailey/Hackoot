const PARTICIPANT_LIST_OVERLAY_OPEN_EVENT = "hackoot:participant-list-overlay-open";

interface ParticipantListOverlayOpenDetail {
  ownerId: string;
}

export function publishParticipantListOverlayOpen(ownerId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<ParticipantListOverlayOpenDetail>(PARTICIPANT_LIST_OVERLAY_OPEN_EVENT, {
      detail: { ownerId },
    })
  );
}

export function subscribeToParticipantListOverlayOpen(
  ownerId: string,
  onOpenedByOtherComponent: () => void
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<ParticipantListOverlayOpenDetail>;
    if (!customEvent.detail) {
      return;
    }

    if (customEvent.detail.ownerId !== ownerId) {
      onOpenedByOtherComponent();
    }
  };

  window.addEventListener(PARTICIPANT_LIST_OVERLAY_OPEN_EVENT, listener as EventListener);

  return () => {
    window.removeEventListener(PARTICIPANT_LIST_OVERLAY_OPEN_EVENT, listener as EventListener);
  };
}
