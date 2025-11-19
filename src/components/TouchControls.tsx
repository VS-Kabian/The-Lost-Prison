import React from "react";

interface TouchControlsProps {
  onLeftStart: () => void;
  onLeftEnd: () => void;
  onRightStart: () => void;
  onRightEnd: () => void;
  onJump: () => void;
  onActionStart: () => void;
  onActionEnd: () => void;
}

/**
 * On-screen touch controls for mobile landscape mode
 * Positioned at bottom corners to avoid covering gameplay
 * Action button: Short press = shoot, Long press = door/bomb
 */
export function TouchControls({
  onLeftStart,
  onLeftEnd,
  onRightStart,
  onRightEnd,
  onJump,
  onActionStart,
  onActionEnd,
}: TouchControlsProps) {
  // Prevent default touch behavior to avoid scrolling/zooming
  const handleTouchStart = (handler: () => void) => (e: React.TouchEvent) => {
    e.preventDefault();
    handler();
  };

  const handleTouchEnd = (handler: () => void) => (e: React.TouchEvent) => {
    e.preventDefault();
    handler();
  };

  return (
    <>
      {/* Left Side Controls - Movement */}
      <div
        className="fixed flex gap-4 z-40"
        style={{
          left: "calc(max(0.5rem, env(safe-area-inset-left)) + 25px)",
          bottom: "calc(max(0.5rem, env(safe-area-inset-bottom)) + 40px)",
        }}
      >
        {/* Left Arrow */}
        <button
          onTouchStart={handleTouchStart(onLeftStart)}
          onTouchEnd={handleTouchEnd(onLeftEnd)}
          className="touch-button"
          aria-label="Move Left"
        >
          <img
            src="/Images/Control/Left Arrow.png"
            alt="Left"
            className="w-full h-full object-contain pointer-events-none"
            draggable={false}
          />
        </button>

        {/* Right Arrow */}
        <button
          onTouchStart={handleTouchStart(onRightStart)}
          onTouchEnd={handleTouchEnd(onRightEnd)}
          className="touch-button"
          aria-label="Move Right"
        >
          <img
            src="/Images/Control/Right Arrow.png"
            alt="Right"
            className="w-full h-full object-contain pointer-events-none"
            draggable={false}
          />
        </button>
      </div>

      {/* Right Side Controls - Actions */}
      <div
        className="fixed flex flex-col gap-2 z-40"
        style={{
          right: "calc(max(0.5rem, env(safe-area-inset-right)) + 15px)",
          bottom: "calc(max(0.5rem, env(safe-area-inset-bottom)) + 40px)",
        }}
      >
        {/* Jump Button (Up) */}
        <button
          onTouchStart={handleTouchStart(onJump)}
          className="touch-button"
          aria-label="Jump"
        >
          <img
            src="/Images/Control/Jump Button.png"
            alt="Jump"
            className="w-full h-full object-contain pointer-events-none"
            draggable={false}
          />
        </button>

        {/* Action Button (Short press: shoot, Long press: door/bomb) */}
        <button
          onTouchStart={handleTouchStart(onActionStart)}
          onTouchEnd={handleTouchEnd(onActionEnd)}
          className="touch-button"
          aria-label="Action"
        >
          <img
            src="/Images/Control/Action Button.png"
            alt="Action"
            className="w-full h-full object-contain pointer-events-none"
            draggable={false}
          />
        </button>
      </div>

      {/* Touch Control Styles */}
      <style>{`
        .touch-button {
          width: 65px;
          height: 65px;
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(8px);
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          user-select: none;
          -webkit-user-select: none;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          padding: 10px;
          opacity: 0.7;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .touch-button:active {
          transform: scale(0.95);
          opacity: 1;
          background: rgba(255, 255, 255, 0.35);
          box-shadow: 0 0 20px rgba(124, 58, 237, 0.7),
                      0 0 40px rgba(124, 58, 237, 0.4),
                      inset 0 0 20px rgba(124, 58, 237, 0.3);
        }

        /* Prevent image dragging and selection */
        .touch-button img {
          -webkit-user-drag: none;
          -khtml-user-drag: none;
          -moz-user-drag: none;
          -o-user-drag: none;
          user-drag: none;
          opacity: 1;
        }
      `}</style>
    </>
  );
}
