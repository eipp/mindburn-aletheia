import React, { useState } from 'react';
import { useWorker } from '../hooks/useWorker';

export const ProfilePage: React.FC = () => {
  const { 
    profile, 
    wallet, 
    loading, 
    error, 
    updateProfile, 
    connectWallet, 
    disconnectWallet
  } = useWorker();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editableProfile, setEditableProfile] = useState({
    name: '',
    email: '',
    taskPreferences: [] as string[],
    languages: [] as string[]
  });
  const [isSaving, setIsSaving] = useState(false);
  
  // Initialize editable profile when profile data is loaded
  React.useEffect(() => {
    if (profile) {
      setEditableProfile({
        name: profile.name || '',
        email: profile.email || '',
        taskPreferences: profile.taskPreferences || [],
        languages: profile.languages || []
      });
    }
  }, [profile]);
  
  // Common task types for preferences
  const availableTaskTypes = [
    { id: 'TEXT_VERIFICATION', label: 'Text Verification' },
    { id: 'IMAGE_VERIFICATION', label: 'Image Verification' },
    { id: 'AUDIO_VERIFICATION', label: 'Audio Verification' },
    { id: 'VIDEO_VERIFICATION', label: 'Video Verification' }
  ];
  
  // Available languages
  const availableLanguages = [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Spanish' },
    { code: 'ru', label: 'Russian' },
    { code: 'fr', label: 'French' },
    { code: 'de', label: 'German' },
    { code: 'it', label: 'Italian' },
    { code: 'zh', label: 'Chinese' },
    { code: 'ja', label: 'Japanese' },
    { code: 'ko', label: 'Korean' },
    { code: 'ar', label: 'Arabic' }
  ];
  
  const handleStartEditing = () => {
    setIsEditing(true);
  };
  
  const handleCancelEditing = () => {
    setIsEditing(false);
    
    // Reset editable profile to original profile values
    if (profile) {
      setEditableProfile({
        name: profile.name || '',
        email: profile.email || '',
        taskPreferences: profile.taskPreferences || [],
        languages: profile.languages || []
      });
    }
  };
  
  const handleSaveProfile = async () => {
    try {
      setIsSaving(true);
      
      await updateProfile({
        name: editableProfile.name,
        email: editableProfile.email,
        taskPreferences: editableProfile.taskPreferences,
        languages: editableProfile.languages
      });
      
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save profile:', err);
      alert('Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleToggleTaskPreference = (taskTypeId: string) => {
    setEditableProfile(prevProfile => {
      const newPreferences = [...prevProfile.taskPreferences];
      
      if (newPreferences.includes(taskTypeId)) {
        // Remove preference
        return {
          ...prevProfile,
          taskPreferences: newPreferences.filter(id => id !== taskTypeId)
        };
      } else {
        // Add preference
        return {
          ...prevProfile,
          taskPreferences: [...newPreferences, taskTypeId]
        };
      }
    });
  };
  
  const handleToggleLanguage = (languageCode: string) => {
    setEditableProfile(prevProfile => {
      const newLanguages = [...prevProfile.languages];
      
      if (newLanguages.includes(languageCode)) {
        // Remove language
        return {
          ...prevProfile,
          languages: newLanguages.filter(code => code !== languageCode)
        };
      } else {
        // Add language
        return {
          ...prevProfile,
          languages: [...newLanguages, languageCode]
        };
      }
    });
  };
  
  if (loading) {
    return (
      <div className="profile-loading">
        <div className="loading-spinner"></div>
        <p>Loading profile...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="profile-error">
        <h2>Error Loading Profile</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>
          Try Again
        </button>
      </div>
    );
  }
  
  return (
    <div className="profile-page">
      <header className="profile-header">
        <h1>Profile</h1>
        {!isEditing ? (
          <button 
            className="edit-profile-button" 
            onClick={handleStartEditing}
          >
            Edit Profile
          </button>
        ) : (
          <div className="edit-buttons">
            <button 
              className="cancel-button" 
              onClick={handleCancelEditing}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button 
              className="save-button" 
              onClick={handleSaveProfile}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </header>
      
      <section className="profile-section">
        <div className="profile-info">
          <div className="profile-field">
            <label>Name</label>
            {isEditing ? (
              <input 
                type="text" 
                value={editableProfile.name} 
                onChange={(e) => setEditableProfile({...editableProfile, name: e.target.value})}
                placeholder="Your name"
              />
            ) : (
              <p>{profile?.name || '-'}</p>
            )}
          </div>
          
          <div className="profile-field">
            <label>Email</label>
            {isEditing ? (
              <input 
                type="email" 
                value={editableProfile.email} 
                onChange={(e) => setEditableProfile({...editableProfile, email: e.target.value})}
                placeholder="Your email"
              />
            ) : (
              <p>{profile?.email || '-'}</p>
            )}
          </div>
          
          <div className="profile-field">
            <label>User ID</label>
            <p>{profile?.id || '-'}</p>
          </div>
          
          <div className="profile-field">
            <label>Account Status</label>
            <p className={`status ${profile?.status || 'pending'}`}>
              {profile?.status || 'Pending'}
            </p>
          </div>
          
          <div className="profile-field">
            <label>Joined</label>
            <p>{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '-'}</p>
          </div>
        </div>
      </section>
      
      <section className="wallet-section">
        <h2>Wallet Connection</h2>
        
        {wallet.isConnected ? (
          <div className="wallet-connected">
            <div className="wallet-info">
              <div className="wallet-address">
                <label>TON Address</label>
                <p className="address">{wallet.address}</p>
              </div>
              <div className="wallet-balance">
                <label>Balance</label>
                <p>{wallet.balance.toFixed(2)} TON</p>
              </div>
            </div>
            
            <button 
              className="disconnect-wallet-button" 
              onClick={disconnectWallet}
            >
              Disconnect Wallet
            </button>
          </div>
        ) : (
          <div className="wallet-disconnected">
            <p>Connect your TON wallet to receive payments for completed tasks.</p>
            <button 
              className="connect-wallet-button" 
              onClick={connectWallet}
              disabled={wallet.isConnecting}
            >
              {wallet.isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          </div>
        )}
      </section>
      
      <section className="preferences-section">
        <h2>Task Preferences</h2>
        
        <div className="task-preferences">
          {isEditing ? (
            <div className="preferences-grid">
              {availableTaskTypes.map(taskType => (
                <label key={taskType.id} className="preference-checkbox">
                  <input 
                    type="checkbox" 
                    checked={editableProfile.taskPreferences.includes(taskType.id)}
                    onChange={() => handleToggleTaskPreference(taskType.id)}
                  />
                  {taskType.label}
                </label>
              ))}
            </div>
          ) : (
            <div className="preferences-tags">
              {profile?.taskPreferences && profile.taskPreferences.length > 0 ? (
                profile.taskPreferences.map(preference => (
                  <span key={preference} className="preference-tag">
                    {availableTaskTypes.find(t => t.id === preference)?.label || preference}
                  </span>
                ))
              ) : (
                <p>No task preferences set</p>
              )}
            </div>
          )}
        </div>
      </section>
      
      <section className="languages-section">
        <h2>Languages</h2>
        
        <div className="languages">
          {isEditing ? (
            <div className="languages-grid">
              {availableLanguages.map(language => (
                <label key={language.code} className="language-checkbox">
                  <input 
                    type="checkbox" 
                    checked={editableProfile.languages.includes(language.code)}
                    onChange={() => handleToggleLanguage(language.code)}
                  />
                  {language.label}
                </label>
              ))}
            </div>
          ) : (
            <div className="language-tags">
              {profile?.languages && profile.languages.length > 0 ? (
                profile.languages.map(code => (
                  <span key={code} className="language-tag">
                    {availableLanguages.find(lang => lang.code === code)?.label || code}
                  </span>
                ))
              ) : (
                <p>No languages set</p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}; 