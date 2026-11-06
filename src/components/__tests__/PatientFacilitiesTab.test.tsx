import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PatientFacilitiesTab } from '../PatientFacilitiesTab';
import type { Facility } from '../../types';

const facility = (id: string, ownership: string | null, facilityType: string | null = null): Facility => ({
  id, name: id, facilityType, ownership, address: null, city: null, district: 'Faridabad', state: 'Haryana',
  contactNumber: null, schemes: [], pmjayListed: false, iphsLevel: 'UNKNOWN', emergencyCapability: 'UNKNOWN',
  distanceKm: null, travelTimeMinutes: null, sourceKind: 'NHA_FACILITY_DIRECTORY', sourceVersion: null,
});

describe('PatientFacilitiesTab ordering', () => {
  it('lists government facilities before private ones, keeping the existing order otherwise', () => {
    render(<PatientFacilitiesTab
      facilities={[
        facility('Private A', 'PRIVATE'),
        facility('Unknown B', null),
        facility('Gov C', 'GOVERNMENT'),
        facility('Private D', 'PRIVATE'),
        facility('Gov E', null, 'PUBLIC'),
        facility('Private F', null, 'PRIVATE'),
      ]}
      schemes={[]}
      scope={null}
      status="ready"
      error={null}
      lang="hi"
      onRetry={() => undefined}
    />);

    const names = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
    expect(names).toEqual(['Gov C', 'Gov E', 'Unknown B', 'Private A', 'Private D', 'Private F']);
  });
});
