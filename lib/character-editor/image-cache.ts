/**
 * Image cache system for character editor
 * Prevents reloading images already in memory
 */

type ImageCacheEntry = {
  image: HTMLImageElement;
  loading: Promise<HTMLImageElement>;
};

class ImageCache {
  private cache = new Map<string, ImageCacheEntry>();
  private loadingPromises = new Map<string, Promise<HTMLImageElement>>();

  /**
   * Load an image with cache
   */
  async loadImage(src: string): Promise<HTMLImageElement> {
    // If already cached, return immediately
    const cached = this.cache.get(src);
    if (cached) {
      return cached.image;
    }

    // If already loading, return same promise
    const loading = this.loadingPromises.get(src);
    if (loading) {
      return loading;
    }

    // Create new loading promise
    const loadPromise = this.createLoadPromise(src);
    this.loadingPromises.set(src, loadPromise);

    try {
      const image = await loadPromise;

      // Save to cache
      this.cache.set(src, { image, loading: loadPromise });
      this.loadingPromises.delete(src);

      return image;
    } catch (error) {
      this.loadingPromises.delete(src);
      throw error;
    }
  }

  private createLoadPromise(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));

      // Important: set crossOrigin before src if needed
      img.src = src;
    });
  }

  /**
   * Pre-carga múltiples imágenes en paralelo
   */
  async preloadImages(srcs: string[]): Promise<void> {
    await Promise.all(srcs.map(src => this.loadImage(src)));
  }

  /**
   * Limpia el caché (útil para liberar memoria)
   */
  clear(): void {
    this.cache.clear();
    this.loadingPromises.clear();
  }

  /**
   * Obtiene estadísticas del caché
   */
  getStats() {
    return {
      cached: this.cache.size,
      loading: this.loadingPromises.size,
    };
  }
}

// Instancia global singleton
export const imageCache = new ImageCache();
