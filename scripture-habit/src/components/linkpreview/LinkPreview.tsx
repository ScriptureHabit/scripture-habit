import { useState, useEffect, FC } from 'react';
import './LinkPreview.css';
import apiClient from '../../Utils/apiClient';

interface PreviewData {
    title?: string;
    description?: string;
    image?: string;
    favicon?: string;
    siteName?: string;
}

interface LinkPreviewProps {
    url: string;
    isSent: boolean;
    language: string | null;
    t?: (key: string) => string;
}

const LinkPreview: FC<LinkPreviewProps> = ({ url, isSent, language }) => {
    const [preview, setPreview] = useState<PreviewData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        const fetchPreview = async () => {
            try {
                setLoading(true);
                setError(false);

                const langParam = language ? `&lang=${language}` : '';
                const response = await apiClient.get<PreviewData>(`/api/url-preview?url=${encodeURIComponent(url)}${langParam}`);

                setPreview(response.data);
            } catch (err) {
                console.error('Error fetching link preview for URL:', url, err);
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        if (url) {
            fetchPreview();
        }
    }, [url, language]);

    if (loading) {
        return (
            <div className={`link-preview loading ${isSent ? 'sent' : 'received'}`}>
                <div className="link-preview-skeleton">
                    <div className="skeleton-text"></div>
                    <div className="skeleton-text short"></div>
                </div>
            </div>
        );
    }

    if (error || !preview) {
        return null; // Just show the link without preview on error
    }

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={`link-preview ${isSent ? 'sent' : 'received'}`}
            onClick={(e) => e.stopPropagation()}
        >
            {preview.image && (
                <div className="link-preview-image">
                    <img
                        src={preview.image}
                        alt=""
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                        }}
                    />
                </div>
            )}
            <div className="link-preview-content">
                <div className="link-preview-site">
                    {preview.favicon && (
                        <img
                            src={preview.favicon}
                            alt=""
                            className="link-preview-favicon"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                    )}
                    <span>{preview.siteName || new URL(url).hostname}</span>
                </div>
                <div className="link-preview-title">
                    {preview.title && preview.title !== url ? preview.title : preview.siteName || url}
                </div>
                {preview.description && (
                    <div className="link-preview-description">
                        {preview.description.length > 100
                            ? preview.description.substring(0, 100) + '...'
                            : preview.description
                        }
                    </div>
                )}
            </div>
        </a>
    );
};

export default LinkPreview;
