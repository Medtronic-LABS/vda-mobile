// Report upload and explanation is off while VDA is used inside the ASHA scope:
// patients expect an answer once they upload. Build with VITE_ENABLE_REPORTS=true to bring it back.
export const REPORTS_ENABLED = import.meta.env.VITE_ENABLE_REPORTS === 'true';
