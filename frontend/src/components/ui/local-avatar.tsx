/**
 * Local Avatar Generator for Air-gapped Environments
 * 
 * Generates simple SVG avatars with initials when external services are unavailable.
 * This ensures the app works completely offline.
 */

interface LocalAvatarProps {
  username: string;
  size?: number;
  className?: string;
}

export function LocalAvatar({ username, size = 48, className = "" }: LocalAvatarProps) {
  // Generate a consistent color based on username
  const generateColor = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Generate a pleasant color from the hash
    const colors = [
      '#3B82F6', // Blue
      '#10B981', // Green  
      '#F59E0B', // Amber
      '#EF4444', // Red
      '#8B5CF6', // Purple
      '#06B6D4', // Cyan
      '#F97316', // Orange
      '#84CC16', // Lime
      '#EC4899', // Pink
      '#6366F1', // Indigo
    ];
    
    return colors[Math.abs(hash) % colors.length] || '#3B82F6';
  };

  const initials = username.slice(0, 2).toUpperCase();
  const backgroundColor = generateColor(username);
  
  // Create SVG data URL
  const svgContent = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${backgroundColor}" rx="${size * 0.15}"/>
      <text 
        x="50%" 
        y="50%" 
        font-family="system-ui, -apple-system, sans-serif" 
        font-size="${size * 0.4}" 
        font-weight="600" 
        text-anchor="middle" 
        dy="0.35em" 
        fill="white"
      >
        ${initials}
      </text>
    </svg>
  `;
  
  const dataUrl = `data:image/svg+xml;base64,${btoa(svgContent)}`;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt={`Avatar for ${username}`}
      className={className}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * Generate avatar data URL for use in img src or CSS
 */
export function generateAvatarDataUrl(username: string, size: number = 48): string {
  const generateColor = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const colors = [
      '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
      '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1',
    ];
    
    return colors[Math.abs(hash) % colors.length] || '#3B82F6';
  };

  const initials = username.slice(0, 2).toUpperCase();
  const backgroundColor = generateColor(username);
  
  const svgContent = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${backgroundColor}" rx="${size * 0.15}"/>
      <text 
        x="50%" 
        y="50%" 
        font-family="system-ui, -apple-system, sans-serif" 
        font-size="${size * 0.4}" 
        font-weight="600" 
        text-anchor="middle" 
        dy="0.35em" 
        fill="white"
      >
        ${initials}
      </text>
    </svg>
  `;
  
  return `data:image/svg+xml;base64,${btoa(svgContent)}`;
}
