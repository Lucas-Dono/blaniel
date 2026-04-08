/**
 * FastSD CPU Local Client
 * 
 * Client for generating images using locally installed FastSD CPU.
 * Supports auto-detection, assisted installation, and uncensored NSFW models.
 * 
 * Features:
 * - Automatic FastSD installation detection
 * - Local REST API (http://localhost:8000)
 * - Civitai NSFW SD 1.5 models
 * - Fast generation with OpenVINO (0.8-2s)
 * - No quota limits or costs
 */

import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface FastSDConfig {
  apiUrl?: string; // Default: http://localhost:8000
  installPath?: string; // Custom installation path
  autoStart?: boolean; // Start FastSD automatically if not running
  useOpenVINO?: boolean; // Use OpenVINO optimization
  model?: string; // Modelo a usar (default: SD 1.5)
}

export interface FastSDGenerationParams {
  prompt: string;
  negativePrompt?: string;
  width?: number; // 256, 512, 768, 1024
  height?: number;
  steps?: number; // 1-25
  guidanceScale?: number;
  seed?: number;
  useOpenVINO?: boolean;
  useTinyAutoencoder?: boolean; // TAESD para 1.4x speedup
}

export interface FastSDGenerationResult {
  imageBase64: string; // Imagen en base64
  seed: number;
  generationTime: number; // Tiempo en segundos
}

export interface FastSDSystemInfo {
  installed: boolean;
  running: boolean;
  version?: string;
  availableModels?: string[];
  device?: string; // CPU, GPU, NPU
  installPath?: string;
}

/** Client for local FastSD CPU */
export class FastSDLocalClient {
  private apiUrl: string;
  private config: FastSDConfig;
  private installPath: string;

  constructor(config?: FastSDConfig) {
    this.config = config || {};
    this.apiUrl = config?.apiUrl || "http://localhost:8000";
    this.installPath = config?.installPath || this.getDefaultInstallPath();
  }

  /** Gets the default installation path based on the operating system */
  private getDefaultInstallPath(): string {
    const homeDir = process.env.HOME || process.env.USERPROFILE || "";
    return path.join(homeDir, "fastsdcpu");
  }

  /** Checks if FastSD is installed */
  async isInstalled(): Promise<boolean> {
    try {
      // Check if the installation directory exists
      if (!fs.existsSync(this.installPath)) {
        return false;
      }

      // Verificar archivos clave
      const keyFiles = ["src/app.py", "requirements.txt", "start-webserver.bat"];
      const hasKeyFiles = keyFiles.some((file) =>
        fs.existsSync(path.join(this.installPath, file))
      );

      return hasKeyFiles;
    } catch (error) {
      console.error("[FastSD] Error checking installation:", error);
      return false;
    }
  }

  /** Checks if the FastSD server is running */
  async isRunning(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.apiUrl}/api/info`, {
        timeout: 2000,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /** Gets FastSD system information */
  async getSystemInfo(): Promise<FastSDSystemInfo> {
    const installed = await this.isInstalled();
    const running = await this.isRunning();

    const info: FastSDSystemInfo = {
      installed,
      running,
      installPath: this.installPath,
    };

    if (running) {
      try {
        // Get server info
        const infoResponse = await axios.get(`${this.apiUrl}/api/info`);
        info.version = infoResponse.data.version;
        info.device = infoResponse.data.device;

        // Get modelos disponibles
        const modelsResponse = await axios.get(`${this.apiUrl}/api/models`);
        info.availableModels = modelsResponse.data.models || [];
      } catch (error) {
        console.warn("[FastSD] Could not fetch server info:", error);
      }
    }

    return info;
  }

  /** Starts the FastSD server if it is not running */
  async startServer(): Promise<boolean> {
    try {
      const running = await this.isRunning();
      if (running) {
        console.log("[FastSD] Server already running");
        return true;
      }

      const installed = await this.isInstalled();
      if (!installed) {
        throw new Error("FastSD not installed. Run installFastSD() first.");
      }

      console.log("[FastSD] Starting server...");

      // Determine command based on OS
      const platform = process.platform;
      let startCommand: string;

      if (platform === "win32") {
        startCommand = "start-webserver.bat";
      } else {
        startCommand = "./start-webserver.sh";
      }

      // Ejecutar en background
      exec(startCommand, { cwd: this.installPath }, (error) => {
        if (error) {
          console.error("[FastSD] Error starting server:", error);
        }
      });

      // Wait for the server to be ready (max 30 seconds)
      for (let i = 0; i < 30; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (await this.isRunning()) {
          console.log("[FastSD] Server started successfully");
          return true;
        }
      }

      throw new Error("Server failed to start within 30 seconds");
    } catch (error) {
      console.error("[FastSD] Failed to start server:", error);
      return false;
    }
  }

  /**
   * Installs FastSD CPU automatically
   * Requires user approval (handled in the service)
   */
  async installFastSD(): Promise<{
    success: boolean;
    message: string;
    installPath: string;
  }> {
    try {
      console.log("[FastSD] Starting installation...");

      const platform = process.platform;

      // Create installation directory
      if (!fs.existsSync(this.installPath)) {
        fs.mkdirSync(this.installPath, { recursive: true });
      }

      // Clonar repositorio
      console.log("[FastSD] Cloning repository...");
      await execAsync(
        `git clone https://github.com/rupeshs/fastsdcpu.git "${this.installPath}"`
      );

      // Execute installation based on platform
      console.log("[FastSD] Running installation script...");

      if (platform === "win32") {
        await execAsync("install.bat", { cwd: this.installPath });
      } else if (platform === "darwin") {
        await execAsync("chmod +x install-mac.sh && ./install-mac.sh", {
          cwd: this.installPath,
        });
      } else {
        // Linux
        await execAsync("chmod +x install.sh && ./install.sh", {
          cwd: this.installPath,
        });
      }

      console.log("[FastSD] Installation completed successfully");

      return {
        success: true,
        message: "FastSD CPU installed successfully",
        installPath: this.installPath,
      };
    } catch (error) {
      console.error("[FastSD] Installation failed:", error);
      return {
        success: false,
        message: `Installation failed: ${error}`,
        installPath: this.installPath,
      };
    }
  }

  /**
   * Genera una imagen usando FastSD CPU
   */
  async generateImage(
    params: FastSDGenerationParams
  ): Promise<FastSDGenerationResult> {
    try {
      // Verify that the server is running
      const running = await this.isRunning();
      if (!running) {
        if (this.config.autoStart) {
          await this.startServer();
        } else {
          throw new Error(
            "FastSD server not running. Set autoStart: true or start manually."
          );
        }
      }

      console.log("[FastSD] Generating image...");
      const startTime = Date.now();

      // Call the generation endpoint
      const response = await axios.post(
        `${this.apiUrl}/api/generate`,
        {
          prompt: params.prompt,
          negative_prompt: params.negativePrompt || "",
          width: params.width || 512,
          height: params.height || 512,
          num_inference_steps: params.steps || 4,
          guidance_scale: params.guidanceScale || 1.0,
          seed: params.seed || -1, // -1 = random
          use_openvino: params.useOpenVINO ?? true,
          use_taesd: params.useTinyAutoencoder ?? true,
        },
        {
          timeout: 60000, // 60 segundos
        }
      );

      const generationTime = (Date.now() - startTime) / 1000;

      console.log(
        `[FastSD] Image generated in ${generationTime.toFixed(2)}s`
      );

      return {
        imageBase64: response.data.image, // Ya viene en base64
        seed: response.data.seed || params.seed || 0,
        generationTime,
      };
    } catch (error) {
      console.error("[FastSD] Generation failed:", error);
      throw error;
    }
  }

  /** Generates a character expression */
  async generateCharacterExpression(params: {
    characterDescription: string;
    emotionType: string;
    intensity: "low" | "medium" | "high";
    seed?: number;
  }): Promise<{ imageBase64: string; seed: number }> {
    const prompt = this.buildExpressionPrompt(
      params.characterDescription,
      params.emotionType,
      params.intensity
    );

    const result = await this.generateImage({
      prompt,
      negativePrompt:
        "text, watermark, signature, ugly, deformed, blurry, low quality, bad anatomy, multiple people, crowd",
      width: 512,
      height: 512,
      steps: 4, // Fast LCM
      guidanceScale: 1.5,
      seed: params.seed,
      useOpenVINO: true,
      useTinyAutoencoder: true,
    });

    return {
      imageBase64: result.imageBase64,
      seed: result.seed,
    };
  }

  /** Builds emotional expression prompt */
  private buildExpressionPrompt(
    characterDescription: string,
    emotionType: string,
    intensity: "low" | "medium" | "high"
  ): string {
    const emotionDescriptors: Record<string, Record<string, string>> = {
      neutral: {
        low: "calm expression, neutral face, relaxed",
        medium: "neutral expression, composed, serene",
        high: "completely neutral, emotionless, blank stare",
      },
      joy: {
        low: "subtle smile, gentle happiness, soft expression",
        medium: "bright smile, joyful expression, happy eyes",
        high: "wide smile, laughing, very happy, radiant expression",
      },
      distress: {
        low: "slightly worried, minor concern, subtle frown",
        medium: "worried expression, distressed, anxious look",
        high: "very distressed, crying, tears, anguished expression",
      },
      fear: {
        low: "slightly nervous, cautious look",
        medium: "fearful expression, scared, wide eyes",
        high: "terrified, extreme fear, panic in eyes",
      },
      anger: {
        low: "slightly annoyed, mild frustration",
        medium: "angry expression, furrowed brows, tense",
        high: "furious, very angry, intense rage",
      },
      affection: {
        low: "warm expression, gentle smile, caring look",
        medium: "loving expression, tender, affectionate gaze",
        high: "very loving, deeply affectionate, passionate",
      },
      concern: {
        low: "slightly concerned, thoughtful expression",
        medium: "concerned look, worried about someone, caring",
        high: "very concerned, deeply worried, protective",
      },
      curiosity: {
        low: "interested look, slight curiosity",
        medium: "curious expression, inquisitive, engaged",
        high: "very curious, fascinated, wide-eyed wonder",
      },
      surprise: {
        low: "slightly surprised, raised eyebrows",
        medium: "surprised expression, open mouth, shocked",
        high: "extremely surprised, astonished, jaw dropped",
      },
      excitement: {
        low: "slightly excited, eager expression",
        medium: "excited, enthusiastic, energetic",
        high: "very excited, thrilled, ecstatic expression",
      },
    };

    const emotionDesc =
      emotionDescriptors[emotionType]?.[intensity] || "neutral expression";

    return `professional portrait photo, ${characterDescription}, ${emotionDesc}, photorealistic, detailed face, natural lighting, high quality, 8k uhd, sharp focus`;
  }

  /**
   * Descarga modelo NSFW de Civitai (opcional)
   */
  async downloadNSFWModel(_modelId: string): Promise<boolean> {
    // TODO: Implementar descarga desde Civitai
    // Por ahora FastSD usa modelos por defecto
    console.warn("[FastSD] Custom model download not implemented yet");
    return false;
  }
}

/**
 * Singleton para reutilizar la misma instancia
 */
let fastSDClientInstance: FastSDLocalClient | null = null;

export function getFastSDLocalClient(
  config?: FastSDConfig
): FastSDLocalClient {
  if (!fastSDClientInstance) {
    fastSDClientInstance = new FastSDLocalClient(config);
  }
  return fastSDClientInstance;
}
