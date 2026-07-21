import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBolt,
  faCircle,
  faCircleExclamation,
  faDatabase,
  faScrewdriverWrench,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type {
  TimelineMarker,
  TimelineSegment,
} from "../../types/machineDetail";
import { InfoDot } from "./InfoDot";

interface TimelineBarProps {
  segments: TimelineSegment[];
  markers: TimelineMarker[];
}

const labels = [
  { key: "ON_LOADED", label: "ON (Loaded)" },
  { key: "ON_NO_LOAD", label: "ON (No-load)" },
  { key: "OFF", label: "OFF" },
  { key: "FAULT", label: "Fault" },
  { key: "MAINTENANCE", label: "Maintenance" },
  { key: "DATA_ISSUE", label: "Data issue" },
];
const markerIcons: Record<TimelineMarker["type"], IconDefinition> = {
  energy: faBolt,
  fault: faCircleExclamation,
  quality: faDatabase,
  maintenance: faScrewdriverWrench,
  gap: faCircle,
};

export function TimelineBar({ segments, markers }: TimelineBarProps) {
  return (
    <section className="md-panel md-timeline-panel">
      <div className="md-panel-header">
        <div className="md-title-with-info">
          <h3>
            Operational Timeline <span>(last 24 hours)</span>
          </h3>
          <InfoDot text="Event-level machine status timeline. Energy and data markers highlight KWh and data-quality issues above status segments." />
        </div>
        <div className="md-timeline-legend">
          {labels.map((item) => (
            <span key={item.key}>
              <i className={`status-${item.key.toLowerCase()}`} />
              {item.label}
            </span>
          ))}
        </div>
      </div>
      <div className="md-timeline-wrap">
        <div className="md-marker-layer">
          {markers.map((marker, index) => (
          <button
              type="button"
              key={marker.id}
            className={`md-timeline-marker marker-${marker.type} level-${marker.severity.toLowerCase()}`}
              style={{ left: `${8 + index * 22}%` }}
            title={`${marker.time} - ${marker.label}`}
            >
              <FontAwesomeIcon icon={markerIcons[marker.type]} />
            </button>
          ))}
        </div>
        <div className="md-timeline-bar">
          {segments.map((segment) => (
            <div
              key={segment.id}
              className={`md-timeline-segment status-${segment.status.toLowerCase()}`}
              style={{ flexGrow: segment.durationMin }}
              title={`${segment.start}-${segment.end}: ${segment.label} | risk ${segment.riskScore ?? 0}`}
            />
          ))}
        </div>
      </div>
      <div className="md-time-axis">
        {[
          "10 PM",
          "12 AM",
          "2 AM",
          "4 AM",
          "6 AM",
          "8 AM",
          "10 AM",
          "12 PM",
          "2 PM",
          "4 PM",
          "6 PM",
          "8 PM",
          "10 PM",
        ].map((time) => (
          <span key={time}>{time}</span>
        ))}
      </div>
    </section>
  );
}
