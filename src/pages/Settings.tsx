import React, { useState } from 'react';
import { Save, Building2, Mail, Phone, Globe, FileText, AlertCircle } from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import { useTenant } from '../context/TenantContext';

const Settings: React.FC = () => {
  const { company, updateCompany } = useCompany();
  const { tenant } = useTenant();
  const [formData, setFormData] = useState(company);
  const [saved, setSaved] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setSaved(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateCompany(formData);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Company Settings</h1>
        <p className="text-slate-600 mt-2">Configure your company information and branding</p>
        {tenant && (
          <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
            <AlertCircle size={16} />
            <span>Settings for: <strong>{tenant.name}</strong> ({tenant.subdomain})</span>
          </div>
        )}
      </div>

      {/* Success Message */}
      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <Save size={20} />
          <span>Company settings saved successfully!</span>
        </div>
      )}

      {/* Company Information Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="border-b border-slate-200 pb-4">
          <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <Building2 size={24} />
            Company Information
          </h2>
          <p className="text-sm text-slate-600 mt-1">This information will appear on invoices, settlements, and reports</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Company Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="Your Company Name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Short Name (for sidebar)
            </label>
            <input
              type="text"
              name="shortName"
              value={formData.shortName || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="Short name or abbreviation"
            />
            <p className="text-xs text-slate-500 mt-1">Leave empty to use full company name</p>
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
              Tax ID / EIN
            </label>
            <input
              type="text"
              name="taxId"
              value={formData.taxId || ''}
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

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Country
            </label>
            <input
              type="text"
              name="country"
              value={formData.country || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="United States"
            />
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Address</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Street Address
              </label>
              <input
                type="text"
                name="address"
                value={formData.address || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="123 Main Street, Suite 100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                City
              </label>
              <input
                type="text"
                name="city"
                value={formData.city || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="City"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                State / Province
              </label>
              <input
                type="text"
                name="state"
                value={formData.state || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="State"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                ZIP / Postal Code
              </label>
              <input
                type="text"
                name="zip"
                value={formData.zip || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="12345"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <FileText size={20} />
            Additional Information
          </h3>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Logo URL (optional)
            </label>
            <input
              type="url"
              name="logo"
              value={formData.logo || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="https://example.com/logo.png"
            />
            <p className="text-xs text-slate-500 mt-1">URL to your company logo image</p>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t border-slate-200">
          <button
            type="submit"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Save size={20} />
            Save Company Settings
          </button>
        </div>
      </form>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Multi-Tenant System</p>
            <p>Company settings are stored per tenant. Each company accessing via their subdomain (company1.mydomain.com) will have their own independent company information.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

