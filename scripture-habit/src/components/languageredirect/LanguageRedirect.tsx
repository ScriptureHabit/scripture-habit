
import { SUPPORTED_LANGUAGES } from '../../../config/languages';
import React from 'react';
import { Navigate, Location } from 'react-router-dom';
import { useLanguage } from '../../../hooks/useLanguage';

interface LanguageRedirectProps {
  location: Location;
}

const LanguageRedirect: React.FC<LanguageRedirectProps> = ({ location }) => {
  const { language } = useLanguage();
  const path = location.pathname;
  const pathParts = path.split('/');
  const firstPart = pathParts[1];

  // Exclude API routes and public assets from language redirection
  const excludedPaths = ['api', 'sw.js', 'manifest.json', 'images', 'favicon.ico', 'logo.svg'];
  if ((SUPPORTED_LANGUAGES as string[]).includes(firstPart) || excludedPaths.includes(firstPart)) {
    return null;
  }

  // Otherwise, prefix with current detected language
  let newPath = `/${language}${path === '/' ? '/' : path}`;
  if (!newPath.endsWith('/')) {
    newPath += '/';
  }

  // Preserve query parameters
  if (location.search) {
    newPath += location.search;
  }

  return <Navigate to={newPath} replace state={location.state} />;
};

export default LanguageRedirect;


