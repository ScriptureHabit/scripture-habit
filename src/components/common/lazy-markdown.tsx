import React, { Suspense } from 'react';
import type { Options } from 'react-markdown';
import { lazyWithRetry } from '../../utils/lazy-with-retry';

const ReactMarkdownComponent = lazyWithRetry(() => import('react-markdown'));

interface LazyMarkdownProps extends Options {
  fallback?: React.ReactNode;
}

const LazyMarkdown: React.FC<LazyMarkdownProps> = ({ fallback, children, ...props }) => {
  return (
    <Suspense fallback={fallback || <span>{typeof children === 'string' ? children : ''}</span>}>
      <ReactMarkdownComponent {...props}>{children}</ReactMarkdownComponent>
    </Suspense>
  );
};

export default LazyMarkdown;
