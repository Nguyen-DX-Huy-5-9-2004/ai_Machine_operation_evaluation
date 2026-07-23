import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBolt,
  faCircle,
  faCircleExclamation,
  faDatabase,
  faScrewdriverWrench,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { useMemo } from 'react';
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
];
const markerIcons: Record<TimelineMarker["type"], IconDefinition> = {
  energy: faBolt,
  fault: faCircleExclamation,
  quality: faDatabase,
  maintenance: faScrewdriverWrench,
  gap: faCircle,
};

function compactSegments(segments: TimelineSegment[], maxSegments = 72): TimelineSegment[] {
  if (segments.length <= maxSegments) return segments;
  const bucketSize = Math.ceil(segments.length / maxSegments);
  const output: TimelineSegment[] = [];
  for (let start = 0; start < segments.length; start += bucketSize) {
    const group = segments.slice(start, start + bucketSize);
    // Representative state is based on actual event frequency. Fault and
    // maintenance remain visible as markers; promoting one rare exception to
    // an entire bucket produced the long artificial colour blocks seen in the
    // replay timeline.
    const counts = group.reduce<Partial<Record<TimelineSegment['status'], number>>>((result, item) => {
      result[item.status] = (result[item.status] ?? 0) + 1;
      return result;
    }, {});
    const representative = group.reduce((best, item) => {
      const itemCount = counts[item.status] ?? 0;
      const bestCount = counts[best.status] ?? 0;
      return itemCount > bestCount ? item : best;
    }, group[0]);
    output.push({
      ...representative,
      id: `density-${group[0].id}-${group[group.length - 1].id}`,
      start: group[0].start,
      end: group[group.length - 1].end,
      durationMin: group.reduce((sum, item) => sum + item.durationMin, 0),
      label: `${representative.label} (${group.length} events)`,
      riskScore: Math.max(...group.map((item) => item.riskScore ?? 0)),
    });
  }
  return output;
}

function compactMarkers(markers: TimelineMarker[], maxMarkers = 10): TimelineMarker[] {
  if (markers.length <= maxMarkers) return markers;
  const weight: Record<TimelineMarker['type'], number> = {
    fault: 5,
    maintenance: 4,
    energy: 3,
    gap: 2,
    quality: 1,
  };
  const bucketSize = Math.ceil(markers.length / maxMarkers);
  const selected: TimelineMarker[] = [];
  for (let start = 0; start < markers.length; start += bucketSize) {
    const group = markers.slice(start, start + bucketSize);
    selected.push(group.reduce((best, marker) => weight[marker.type] > weight[best.type] ? marker : best, group[0]));
  }
  return selected;
}

export function TimelineBar({ segments, markers }: TimelineBarProps) {
  const visibleSegments = useMemo(() => compactSegments(segments), [segments]);
  const visibleMarkers = useMemo(() => compactMarkers(markers), [markers]);
  const first = new Date(segments[0]?.start ?? 0).valueOf();
  const lastSegment = segments[segments.length - 1];
  const last = new Date(lastSegment?.end ?? lastSegment?.start ?? 0).valueOf();
  const range = Math.max(last - first, 1);
  const axis = Array.from({ length: 6 }, (_, index) => {
    const at = new Date(first + range * index / 5);
    return Number.isNaN(at.valueOf()) ? '' : at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });
  const markerPosition = (marker: TimelineMarker) => {
    const point = new Date(marker.time).valueOf();
    return Number.isFinite(point) ? Math.max(1, Math.min(99, (point - first) / range * 100)) : 50;
  };
  return (
    <section className="md-panel md-timeline-panel">
      <div className="md-panel-header">
        <div className="md-title-with-info">
          <h3>
            Operational Timeline <span>(selected range)</span>
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
          {visibleMarkers.map((marker) => (
          <button
              type="button"
              key={marker.id}
            className={`md-timeline-marker marker-${marker.type} level-${marker.severity.toLowerCase()}`}
              style={{ left: `${markerPosition(marker)}%` }}
            title={`${marker.time} - ${marker.label}`}
            >
              <FontAwesomeIcon icon={markerIcons[marker.type]} />
            </button>
          ))}
        </div>
        <div className="md-timeline-bar">
          {visibleSegments.map((segment) => (
            <div
              key={segment.id}
              className={`md-timeline-segment status-${segment.status.toLowerCase()}`}
              // The current detail workspace defaults to event spacing. Keep
              // every rendered bucket visually equal; duration remains in the
              // tooltip so one long source event cannot consume the timeline.
              style={{ flex: '1 1 0' }}
              title={`${segment.start}-${segment.end}: ${segment.label} | risk ${segment.riskScore ?? 0}`}
            />
          ))}
        </div>
      </div>
      <div className="md-time-axis">
        {axis.map((time, index) => (
          <span key={`${time}-${index}`}>{time}</span>
        ))}
      </div>
      {segments.length > visibleSegments.length && <p className="md-density-note">Timeline condensed from {segments.length.toLocaleString()} to {visibleSegments.length} visual intervals; markers remain event-timed.</p>}
    </section>
  );
}
