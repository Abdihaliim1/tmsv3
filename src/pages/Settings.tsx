import React, { useState, useEffect, useRef } from 'react';
import {
  Save, Building2, Mail, Phone, Globe, FileText, AlertCircle,
  Upload, Image as ImageIcon, Palette, Eye, Download, RotateCcw,
  CheckCircle, X, Loader, Database, Truck
} from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import { useTenant } from '../context/TenantContext';
import { useTMS } from '../context/TMSContext';
import { CompanyProfile } from '../types';
import ExportMenu from '../components/ExportMenu';
import { generateDemoLoads } from '../utils/seedData';

const Settings: React.FC = () => {
  const { companyProfile, updateCompanyProfile, theme } = useCompany();
  const { tenant } = useTenant();
  const { addLoad, loads } = useTMS();
  const [formData, setFormData] = useState<Partial<CompanyProfile>>(companyProfile);
  const [saved, setSaved] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [isLoadingDemoData, setIsLoadingDemoData] = useState(false);
  const [demoDataLoaded, setDemoDataLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if setup is needed
  useEffect(() => {
    if (!companyProfile.isSetupComplete && 
        (!companyProfile.companyName || companyProfile.companyName === 'Transportation Management System')) {
      setShowSetupWizard(true);
    }
  }, [companyProfile]);

  // Update form data when companyProfile changes
  useEffect(() => {
    setFormData(companyProfile);
  }, [companyProfile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setSaved(false);
  };

  const handleColorChange = (field: 'primaryColor' | 'accentColor', value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a PNG, JPG, or SVG image');
      return;
    }

    // Validate file size (2MB limit)
    if (file.size > 2 * 1024 * 1024) {
      alert('File size must be less than 2MB');
      return;
    }

    setIsUploading(true);

    try {
      // Convert to base64 for localStorage (in production, upload to Firebase Storage)
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setFormData(prev => ({ ...prev, logoUrl: base64String }));
        setSaved(false);
        setIsUploading(false);
      };
      reader.onerror = () => {
        alert('Error reading file');
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading logo:', error);
      alert('Error uploading logo');
      setIsUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.companyName || !formData.address1 || !formData.city || !formData.state || !formData.zip) {
      alert('Please fill in all required fields (Company Name, Address, City, State, ZIP)');
      return;
    }

    updateCompanyProfile({
      ...formData,
      isSetupComplete: true,
    } as Partial<CompanyProfile>);
    
    setSaved(true);
    setShowSetupWizard(false);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleResetTheme = () => {
    if (confirm('Reset theme colors to defaults?')) {
      setFormData(prev => ({
        ...prev,
        primaryColor: '#1D4ED8',
        accentColor: '#0EA5E9',
      }));
      setSaved(false);
    }
  };

  const handleDownloadProfile = () => {
    const dataStr = JSON.stringify(companyProfile, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `company-profile-${companyProfile.tenantId}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleLoadDemoData = async () => {
    if (isLoadingDemoData) return;

    const confirmLoad = window.confirm(
      'This will add 20 demo loads to your system with realistic trucking data including various statuses (Available, Dispatched, In Transit, Delivered, Completed).\n\nDo you want to proceed?'
    );

    if (!confirmLoad) return;

    setIsLoadingDemoData(true);
    setDemoDataLoaded(false);

    try {
      const demoLoads = generateDemoLoads();

      // Add loads with a small delay between each to avoid overwhelming the system
      for (let i = 0; i < demoLoads.length; i++) {
        await addLoad(demoLoads[i]);
        // Small delay to allow state updates
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setDemoDataLoaded(true);
      setTimeout(() => setDemoDataLoaded(false), 5000);
    } catch (error) {
      console.error('Error loading demo data:', error);
      alert('Error loading demo data. Please try again.');
    } finally {
      setIsLoadingDemoData(false);
    }
  };

  // Setup Wizard Component
  const SetupWizard = () => {
    const [step, setStep] = useState(1);
    const [wizardData, setWizardData] = useState({
      companyName: '',
      address1: '',
      city: '',
      state: '',
      zip: '',
      logoUrl: '',
      primaryColor: '#1D4ED8',
    });

    const handleWizardNext = () => {
      if (step === 1 && !wizardData.companyName) {
        alert('Please enter your company name');
        return;
      }
      if (step === 2 && (!wizardData.address1 || !wizardData.city || !wizardData.state || !wizardData.zip)) {
        alert('Please fill in all address fields');
        return;
      }
      if (step < 5) {
        setStep(step + 1);
      } else {
        // Save and complete setup
        updateCompanyProfile({
          ...wizardData,
          country: 'United States',
          isSetupComplete: true,
        } as Partial<CompanyProfile>);
        setShowSetupWizard(false);
      }
    };

    // Handle ESC key to close wizard
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSetupWizard(false);
      }
    };

    // Skip wizard and close
    const handleSkip = () => {
      setShowSetupWizard(false);
    };

    // Add ESC listener
    React.useEffect(() => {
      document.addEventListener('keydown', handleEscKey);
      return () => document.removeEventListener('keydown', handleEscKey);
    }, []);

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative">
          {/* Close button (X) */}
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Close (ESC)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>

          <div className="p-6 border-b border-slate-200">
            <h2 className="text-2xl font-bold text-slate-900">Welcome! Let's Set Up Your Company</h2>
            <p className="text-slate-600 mt-1">Complete these steps to customize your TMS</p>
            <div className="mt-4 flex gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <div
                  key={s}
                  className={`flex-1 h-2 rounded ${
                    s <= step ? 'bg-blue-600' : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="p-6">
            {step === 1 && (
              <div>
                <h3 className="text-xl font-semibold mb-4">Step 1: Company Name</h3>
                <input
                  type="text"
                  value={wizardData.companyName}
                  onChange={(e) => setWizardData({ ...wizardData, companyName: e.target.value })}
                  placeholder="Enter your company name"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
            )}

            {step === 2 && (
              <div>
                <h3 className="text-xl font-semibold mb-4">Step 2: Address</h3>
                <div className="space-y-4">
                  <input
                    type="text"
                    value={wizardData.address1}
                    onChange={(e) => setWizardData({ ...wizardData, address1: e.target.value })}
                    placeholder="Street Address"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="grid grid-cols-3 gap-4">
                    <input
                      type="text"
                      value={wizardData.city}
                      onChange={(e) => setWizardData({ ...wizardData, city: e.target.value })}
                      placeholder="City"
                      className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={wizardData.state}
                      onChange={(e) => setWizardData({ ...wizardData, state: e.target.value })}
                      placeholder="State"
                      className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={wizardData.zip}
                      onChange={(e) => setWizardData({ ...wizardData, zip: e.target.value })}
                      placeholder="ZIP"
                      className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <h3 className="text-xl font-semibold mb-4">Step 3: Logo (Optional)</h3>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                  {wizardData.logoUrl ? (
                    <div>
                      <img src={wizardData.logoUrl} alt="Logo preview" className="max-h-32 mx-auto mb-4" />
                      <button
                        onClick={() => setWizardData({ ...wizardData, logoUrl: '' })}
                        className="text-sm text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div>
                      <Upload size={48} className="mx-auto text-slate-400 mb-4" />
                      <p className="text-slate-600 mb-4">Upload your company logo</p>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setWizardData({ ...wizardData, logoUrl: reader.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                        id="wizard-logo"
                      />
                      <label
                        htmlFor="wizard-logo"
                        className="btn-primary inline-block px-4 py-2 rounded-lg cursor-pointer"
                      >
                        Choose File
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 4 && (
              <div>
                <h3 className="text-xl font-semibold mb-4">Step 4: Primary Color</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Brand Color</label>
                    <div className="flex items-center gap-4">
                      <input
                        type="color"
                        value={wizardData.primaryColor}
                        onChange={(e) => setWizardData({ ...wizardData, primaryColor: e.target.value })}
                        className="w-20 h-12 border border-slate-300 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={wizardData.primaryColor}
                        onChange={(e) => setWizardData({ ...wizardData, primaryColor: e.target.value })}
                        className="flex-1 px-4 py-2 border border-slate-300 rounded-lg"
                        placeholder="#1D4ED8"
                      />
                    </div>
                  </div>
                  <div className="p-4 rounded-lg" style={{ backgroundColor: wizardData.primaryColor + '20' }}>
                    <p className="text-sm text-slate-600">Preview: This color will be used throughout your TMS</p>
                  </div>
                </div>
              </div>
            )}

            {step === 5 && (
              <div>
                <h3 className="text-xl font-semibold mb-4">Step 5: Review & Save</h3>
                <div className="bg-slate-50 rounded-lg p-6 space-y-3">
                  <div>
                    <span className="text-sm font-medium text-slate-600">Company:</span>
                    <p className="text-lg font-semibold">{wizardData.companyName}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-slate-600">Address:</span>
                    <p>{wizardData.address1}, {wizardData.city}, {wizardData.state} {wizardData.zip}</p>
                  </div>
                  {wizardData.logoUrl && (
                    <div>
                      <span className="text-sm font-medium text-slate-600">Logo:</span>
                      <img src={wizardData.logoUrl} alt="Logo" className="h-16 mt-2" />
                    </div>
                  )}
                  <div>
                    <span className="text-sm font-medium text-slate-600">Primary Color:</span>
                    <div className="flex items-center gap-2 mt-2">
                      <div
                        className="w-8 h-8 rounded border border-slate-300"
                        style={{ backgroundColor: wizardData.primaryColor }}
                      />
                      <span>{wizardData.primaryColor}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center mt-6">
              <div className="flex items-center gap-4">
                {step > 1 && (
                  <button
                    onClick={() => setStep(step - 1)}
                    className="px-4 py-2 text-slate-600 hover:text-slate-900"
                  >
                    ← Back
                  </button>
                )}
                <button
                  onClick={handleSkip}
                  className="text-sm text-slate-500 hover:text-slate-700 underline"
                >
                  Skip for now
                </button>
              </div>
              <button
                onClick={handleWizardNext}
                className="btn-primary px-6 py-2 rounded-lg"
              >
                {step === 5 ? 'Complete Setup' : 'Next →'}
              </button>
            </div>

            <p className="text-xs text-slate-400 text-center mt-4">
              Press ESC to close • You can always set this up later in Settings
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Setup Wizard */}
      {showSetupWizard && <SetupWizard />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Company Settings</h1>
          <p className="text-slate-600 mt-2">Customize your company profile, branding, and document settings</p>
          {tenant && (
            <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
              <AlertCircle size={16} />
              <span>Settings for: <strong>{tenant.name}</strong> ({tenant.subdomain})</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2"
          >
            <Eye size={18} />
            {showPreview ? 'Hide' : 'Show'} Preview
          </button>
          <button
            onClick={handleDownloadProfile}
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2"
          >
            <Download size={18} />
            Export
          </button>
        </div>
      </div>

      {/* Success Message */}
      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle size={20} />
          <span>Company settings saved successfully!</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-6">
            {/* Company Information Section */}
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                <Building2 size={24} />
                Company Information
              </h2>
              <p className="text-sm text-slate-600 mt-1">This information appears on invoices, settlements, and reports</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName || ''}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Your Company Name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Legal Name
                </label>
                <input
                  type="text"
                  name="legalName"
                  value={formData.legalName || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Legal entity name (optional)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tagline
                </label>
                <input
                  type="text"
                  name="tagline"
                  value={formData.tagline || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Your company tagline (optional)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  MC Number
                </label>
                <input
                  type="text"
                  name="mcNumber"
                  value={formData.mcNumber || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="MC-123456"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  DOT Number
                </label>
                <input
                  type="text"
                  name="dotNumber"
                  value={formData.dotNumber || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="DOT 1234567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  EIN / Tax ID
                </label>
                <input
                  type="text"
                  name="ein"
                  value={formData.ein || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="12-3456789"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <Phone size={16} className="inline mr-1" />
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <Mail size={16} className="inline mr-1" />
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="contact@company.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <Globe size={16} className="inline mr-1" />
                  Website
                </label>
                <input
                  type="url"
                  name="website"
                  value={formData.website || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="www.company.com"
                />
              </div>
            </div>

            {/* Address Section */}
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Address</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Street Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="address1"
                    value={formData.address1 || ''}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="123 Main Street, Suite 100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    name="address2"
                    value={formData.address2 || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="Suite, Unit, etc. (optional)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city || ''}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="City"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    State <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state || ''}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="State"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    ZIP Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="zip"
                    value={formData.zip || ''}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="12345"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    name="country"
                    value={formData.country || 'United States'}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="United States"
                  />
                </div>
              </div>
            </div>

            {/* Branding Section */}
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Palette size={20} />
                Branding
              </h3>
              
              {/* Logo Upload */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Company Logo
                </label>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6">
                  {formData.logoUrl ? (
                    <div className="flex items-center gap-4">
                      <img 
                        src={formData.logoUrl} 
                        alt="Company logo" 
                        className="h-20 w-auto object-contain"
                      />
                      <div className="flex-1">
                        <p className="text-sm text-slate-600">Logo uploaded</p>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, logoUrl: undefined }));
                            setSaved(false);
                          }}
                          className="text-sm text-red-600 hover:text-red-700 mt-1"
                        >
                          Remove logo
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <ImageIcon size={48} className="mx-auto text-slate-400 mb-2" />
                      <p className="text-sm text-slate-600 mb-2">Upload your company logo</p>
                      <p className="text-xs text-slate-500 mb-4">PNG, JPG, or SVG (max 2MB)</p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                        onChange={handleLogoUpload}
                        className="hidden"
                        id="logo-upload"
                      />
                      <label
                        htmlFor="logo-upload"
                        className="btn-primary inline-block px-4 py-2 rounded-lg cursor-pointer transition-colors"
                      >
                        {isUploading ? (
                          <span className="flex items-center gap-2">
                            <Loader size={16} className="animate-spin" />
                            Uploading...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <Upload size={16} />
                            Choose File
                          </span>
                        )}
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Theme Colors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Primary Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={formData.primaryColor || '#1D4ED8'}
                      onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                      className="w-16 h-12 border border-slate-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.primaryColor || '#1D4ED8'}
                      onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholder="#1D4ED8"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Used for buttons, links, and accents</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Accent Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={formData.accentColor || '#0EA5E9'}
                      onChange={(e) => handleColorChange('accentColor', e.target.value)}
                      className="w-16 h-12 border border-slate-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.accentColor || '#0EA5E9'}
                      onChange={(e) => handleColorChange('accentColor', e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholder="#0EA5E9"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Used for highlights and secondary elements</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleResetTheme}
                className="mt-4 px-4 py-2 text-sm text-slate-600 hover:text-slate-900 flex items-center gap-2"
              >
                <RotateCcw size={16} />
                Reset to Default Colors
              </button>
            </div>

            {/* Document Settings Section */}
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <FileText size={20} />
                Document Settings
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Invoice Prefix
                  </label>
                  <input
                    type="text"
                    name="invoicePrefix"
                    value={formData.invoicePrefix || 'INV'}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="INV"
                  />
                  <p className="text-xs text-slate-500 mt-1">Invoice numbers will be: {formData.invoicePrefix || 'INV'}-YYYY-NNNN</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Settlement Prefix
                  </label>
                  <input
                    type="text"
                    name="settlementPrefix"
                    value={formData.settlementPrefix || 'SET'}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="SET"
                  />
                  <p className="text-xs text-slate-500 mt-1">Settlement numbers will use this prefix</p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Default Footer Text (for PDFs)
                  </label>
                  <textarea
                    name="defaultFooterText"
                    value={formData.defaultFooterText || ''}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="Thank you for your business. All payments are made to 1099 Independent Contractors."
                  />
                  <p className="text-xs text-slate-500 mt-1">This text will appear at the bottom of settlement and invoice PDFs</p>
                </div>
              </div>
            </div>

            {/* Export Section */}
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Download size={20} />
                Data Export & Backup
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                Export your data for backup or analysis. All exports are generated client-side for privacy.
              </p>
              <ExportMenu />
            </div>

            {/* Developer Tools Section */}
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Database size={20} />
                Developer Tools
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                Tools for testing and demo purposes. Use these to populate your system with sample data.
              </p>

              {/* Demo Data Loaded Success Message */}
              {demoDataLoaded && (
                <div className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
                  <CheckCircle size={20} />
                  <span>Successfully loaded 20 demo loads! Check the Loads page to view them.</span>
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Truck size={24} className="text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900">Load Demo Data</h4>
                    <p className="text-sm text-slate-600 mt-1 mb-3">
                      Add 20 realistic trucking loads with various statuses, routes, and brokers.
                      Includes loads from major brokers like TQL, C.H. Robinson, XPO, and more.
                    </p>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={handleLoadDemoData}
                        disabled={isLoadingDemoData}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                      >
                        {isLoadingDemoData ? (
                          <>
                            <Loader size={16} className="animate-spin" />
                            Loading {loads.length > 0 ? `(${loads.length} loads)` : '...'}
                          </>
                        ) : (
                          <>
                            <Database size={16} />
                            Load 20 Demo Loads
                          </>
                        )}
                      </button>
                      <span className="text-xs text-slate-500">
                        Current loads: {loads.length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t border-slate-200">
              <button
                type="submit"
                className="px-6 py-3 text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
                style={{ backgroundColor: theme.primary }}
              >
                <Save size={20} />
                Save Company Settings
              </button>
            </div>
          </form>
        </div>

        {/* Preview Panel */}
        {showPreview && (
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 sticky top-20">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Eye size={20} />
                Preview
              </h3>
              
              {/* Company Header Preview */}
              <div className="border border-slate-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-3 mb-3">
                  {formData.logoUrl && (
                    <img 
                      src={formData.logoUrl} 
                      alt="Logo" 
                      className="h-12 w-auto object-contain"
                    />
                  )}
                  <div>
                    <h4 className="font-bold text-lg" style={{ color: formData.primaryColor || theme.primary }}>
                      {formData.companyName || 'Your Company Name'}
                    </h4>
                    {formData.tagline && (
                      <p className="text-xs text-slate-600">{formData.tagline}</p>
                    )}
                  </div>
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  {formData.address1 && (
                    <p>{formData.address1}</p>
                  )}
                  {formData.address2 && (
                    <p>{formData.address2}</p>
                  )}
                  {(formData.city || formData.state || formData.zip) && (
                    <p>
                      {[formData.city, formData.state, formData.zip].filter(Boolean).join(', ')}
                      {formData.country && `, ${formData.country}`}
                    </p>
                  )}
                  {formData.phone && <p>Phone: {formData.phone}</p>}
                  {formData.email && <p>Email: {formData.email}</p>}
                  {formData.website && <p>Web: {formData.website}</p>}
                  {formData.dotNumber && <p>DOT: {formData.dotNumber}</p>}
                </div>
              </div>

              {/* Color Preview */}
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Theme Colors</p>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <div
                        className="h-12 rounded border border-slate-300 mb-1"
                        style={{ backgroundColor: formData.primaryColor || theme.primary }}
                      />
                      <p className="text-xs text-slate-600">Primary</p>
                    </div>
                    <div className="flex-1">
                      <div
                        className="h-12 rounded border border-slate-300 mb-1"
                        style={{ backgroundColor: formData.accentColor || theme.accent }}
                      />
                      <p className="text-xs text-slate-600">Accent</p>
                    </div>
                  </div>
                </div>

                {/* Button Preview */}
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Button Preview</p>
                  <button
                    className="w-full px-4 py-2 text-white rounded-lg text-sm"
                    style={{ backgroundColor: formData.primaryColor || theme.primary }}
                  >
                    Sample Button
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-200">
                <p className="text-xs text-slate-500">
                  This preview shows how your company information will appear on invoices, settlements, and throughout the app.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Multi-Tenant System</p>
            <p>Company settings are stored per tenant. Each company accessing via their subdomain will have their own independent company information and branding.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
