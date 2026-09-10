/**
 * VDA Mobile — EscalationModal Component Tests (P0 Safety-Critical UI)
 *
 * Validates:
 * - Connecting header and alert indicator
 * - Patient and clinician message rendering
 * - Fallback card and eSanjeevani action trigger
 * - Message form submission to clinician
 * - Nearby emergency facility list expansion
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EscalationModal } from '../EscalationModal';
import { ClinicalReviewState } from '../../types';

describe('VDA Mobile — EscalationModal Component', () => {
  const baseReviewState: ClinicalReviewState = {
    reviewRequested: true,
    teleconsultationOffered: false,
    teleconsultationConfigured: false,
    clinicalChatState: 'WAITING_FOR_CLINICIAN',
    clinicianResponseDeadline: new Date(Date.now() + 30000),
    firstClinicianResponseAt: null,
    fallbackShownAt: null,
    nearbyFacilities: [],
    messages: [
      {
        speaker: 'PATIENT',
        text: 'I have severe chest pain',
        createdAt: new Date(),
      },
    ],
  };

  it('should render connecting notice when waiting for clinician', () => {
    render(
      <EscalationModal
        review={baseReviewState}
        emergencyInstruction="Please remain calm and call 108"
        lang="en"
        onSendMessageToClinician={vi.fn()}
        onOpenTeleconsultation={vi.fn()}
      />
    );

    expect(screen.getByText(/Clinical assistance/i)).toBeInTheDocument();
    expect(screen.getByText(/Connecting to the clinical team/i)).toBeInTheDocument();
    expect(screen.getByText('I have severe chest pain')).toBeInTheDocument();
    expect(screen.getByText(/If your condition is serious or getting worse/i)).toBeInTheDocument();
  });

  it('should render connected state when clinician responds', () => {
    const connectedState: ClinicalReviewState = {
      ...baseReviewState,
      clinicalChatState: 'CLINICIAN_CONNECTED',
      firstClinicianResponseAt: new Date(),
      messages: [
        ...baseReviewState.messages,
        {
          speaker: 'CLINICIAN',
          text: 'Hello, this is Dr. Sharma. Are you with someone right now?',
          createdAt: new Date(),
        },
      ],
    };

    render(
      <EscalationModal
        review={connectedState}
        emergencyInstruction="Call 108 immediately"
        lang="en"
        onSendMessageToClinician={vi.fn()}
        onOpenTeleconsultation={vi.fn()}
      />
    );

    expect(screen.getByText(/Clinical team connected/i)).toBeInTheDocument();
    expect(screen.getByText(/Hello, this is Dr. Sharma/i)).toBeInTheDocument();
  });

  it('should show fallback card with eSanjeevani button when teleconsultation is offered', () => {
    const fallbackState: ClinicalReviewState = {
      ...baseReviewState,
      teleconsultationOffered: true,
      nearbyFacilities: [
        {
          name: 'District Hospital Sitapur',
          state: 'Uttar Pradesh',
          district: 'Sitapur',
          city: 'Sitapur',
          address: 'Station Road',
          contactNumber: '+91 5862 242200',
          hospitalType: 'District Hospital',
          schemes: ['PMJAY'],
          emergencyCapabilityVerified: true,
          distanceKm: 2.8,
          travelTimeMinutes: 10,
        },
      ],
    };

    const mockOpenTeleconsultation = vi.fn();

    render(
      <EscalationModal
        review={fallbackState}
        emergencyInstruction="Emergency guidelines"
        lang="en"
        onSendMessageToClinician={vi.fn()}
        onOpenTeleconsultation={mockOpenTeleconsultation}
      />
    );

    expect(screen.getByText(/The clinical team has not joined yet/i)).toBeInTheDocument();
    const teleconsultBtn = screen.getByText(/Talk to eSanjeevani/i);
    expect(teleconsultBtn).toBeInTheDocument();

    fireEvent.click(teleconsultBtn);
    expect(mockOpenTeleconsultation).toHaveBeenCalledTimes(1);
  });

  it('should expand nearby facilities when toggle button is clicked', () => {
    const fallbackState: ClinicalReviewState = {
      ...baseReviewState,
      teleconsultationOffered: true,
      nearbyFacilities: [
        {
          name: 'AIIMS Trauma Centre',
          state: 'Delhi',
          district: 'New Delhi',
          city: 'Delhi',
          address: 'Ring Road',
          contactNumber: '+91 11 26588500',
          hospitalType: 'Apex Institute',
          schemes: ['PMJAY'],
          emergencyCapabilityVerified: true,
          distanceKm: 5.2,
          travelTimeMinutes: 15,
        },
      ],
    };

    render(
      <EscalationModal
        review={fallbackState}
        emergencyInstruction="Emergency guidelines"
        lang="en"
        onSendMessageToClinician={vi.fn()}
        onOpenTeleconsultation={vi.fn()}
      />
    );

    const toggleBtn = screen.getByRole('button', { name: /Nearby hospitals/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByText('AIIMS Trauma Centre')).toBeInTheDocument();
  });

  it('should submit patient reply to onSendMessageToClinician', async () => {
    const mockSend = vi.fn().mockResolvedValue(undefined);

    render(
      <EscalationModal
        review={baseReviewState}
        emergencyInstruction="Emergency guidelines"
        lang="en"
        onSendMessageToClinician={mockSend}
        onOpenTeleconsultation={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/Write a message to the clinical team/i);
    fireEvent.change(input, { target: { value: 'My brother is here with me' } });

    const submitBtn = screen.getByRole('button', { name: '' }); // Send button
    fireEvent.submit(input.closest('form')!);

    expect(mockSend).toHaveBeenCalledWith('My brother is here with me');
  });
});
