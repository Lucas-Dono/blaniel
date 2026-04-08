/**
 * Minecraft Skins Component Generator
 * 
 * Generates base sprites (in grayscale) that are later recolored programmatically
 */

import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import {ComponentCategory} from '@/types/minecraft-skin-components';
import * as HairLib from './hairstyles-library';

// ============================================================================
// CONSTANTES DE MINECRAFT
// ============================================================================

/**
 * Dimensiones de skin de Minecraft
 */
export const SKIN_WIDTH = 64;
export const SKIN_HEIGHT = 64;

/** Standard Minecraft UV coordinates (64x64) */
export const UV_REGIONS = {
  // CABEZA (Head)
  HEAD_FRONT: { x: 8, y: 8, width: 8, height: 8, name: 'head_front' },
  HEAD_RIGHT: { x: 0, y: 8, width: 8, height: 8, name: 'head_right' },
  HEAD_LEFT: { x: 16, y: 8, width: 8, height: 8, name: 'head_left' },
  HEAD_TOP: { x: 8, y: 0, width: 8, height: 8, name: 'head_top' },
  HEAD_BOTTOM: { x: 16, y: 0, width: 8, height: 8, name: 'head_bottom' },
  HEAD_BACK: { x: 24, y: 8, width: 8, height: 8, name: 'head_back' },

  // HEAD OVERLAY (Hat/Hair - +0.5px larger)
  HAT_TOP: { x: 40, y: 0, width: 8, height: 8, name: 'hat_top' },
  HAT_FRONT: { x: 40, y: 8, width: 8, height: 8, name: 'hat_front' },
  HAT_RIGHT: { x: 32, y: 8, width: 8, height: 8, name: 'hat_right' },
  HAT_LEFT: { x: 48, y: 8, width: 8, height: 8, name: 'hat_left' },
  HAT_BACK: { x: 56, y: 8, width: 8, height: 8, name: 'hat_back' },
  HAT_BOTTOM: { x: 48, y: 0, width: 8, height: 8, name: 'hat_bottom' },

  // TORSO (Body)
  BODY_FRONT: { x: 20, y: 20, width: 8, height: 12, name: 'body_front' },
  BODY_BACK: { x: 32, y: 20, width: 8, height: 12, name: 'body_back' },
  BODY_RIGHT: { x: 16, y: 20, width: 4, height: 12, name: 'body_right' },
  BODY_LEFT: { x: 28, y: 20, width: 4, height: 12, name: 'body_left' },
  BODY_TOP: { x: 20, y: 16, width: 8, height: 4, name: 'body_top' },
  BODY_BOTTOM: { x: 28, y: 16, width: 8, height: 4, name: 'body_bottom' },

  // BRAZO DERECHO (Right Arm - modelo Classic 4px)
  ARM_R_FRONT: { x: 44, y: 20, width: 4, height: 12, name: 'arm_r_front' },
  ARM_R_BACK: { x: 52, y: 20, width: 4, height: 12, name: 'arm_r_back' },
  ARM_R_RIGHT: { x: 40, y: 20, width: 4, height: 12, name: 'arm_r_right' },
  ARM_R_LEFT: { x: 48, y: 20, width: 4, height: 12, name: 'arm_r_left' },
  ARM_R_TOP: { x: 44, y: 16, width: 4, height: 4, name: 'arm_r_top' },
  ARM_R_BOTTOM: { x: 48, y: 16, width: 4, height: 4, name: 'arm_r_bottom' },

  // BRAZO IZQUIERDO (Left Arm - modelo Classic 4px)
  ARM_L_FRONT: { x: 36, y: 52, width: 4, height: 12, name: 'arm_l_front' },
  ARM_L_BACK: { x: 44, y: 52, width: 4, height: 12, name: 'arm_l_back' },
  ARM_L_RIGHT: { x: 32, y: 52, width: 4, height: 12, name: 'arm_l_right' },
  ARM_L_LEFT: { x: 40, y: 52, width: 4, height: 12, name: 'arm_l_left' },
  ARM_L_TOP: { x: 36, y: 48, width: 4, height: 4, name: 'arm_l_top' },
  ARM_L_BOTTOM: { x: 40, y: 48, width: 4, height: 4, name: 'arm_l_bottom' },

  // PIERNA DERECHA (Right Leg)
  LEG_R_FRONT: { x: 4, y: 20, width: 4, height: 12, name: 'leg_r_front' },
  LEG_R_BACK: { x: 12, y: 20, width: 4, height: 12, name: 'leg_r_back' },
  LEG_R_RIGHT: { x: 0, y: 20, width: 4, height: 12, name: 'leg_r_right' },
  LEG_R_LEFT: { x: 8, y: 20, width: 4, height: 12, name: 'leg_r_left' },
  LEG_R_TOP: { x: 4, y: 16, width: 4, height: 4, name: 'leg_r_top' },
  LEG_R_BOTTOM: { x: 8, y: 16, width: 4, height: 4, name: 'leg_r_bottom' },

  // PIERNA IZQUIERDA (Left Leg)
  LEG_L_FRONT: { x: 20, y: 52, width: 4, height: 12, name: 'leg_l_front' },
  LEG_L_BACK: { x: 28, y: 52, width: 4, height: 12, name: 'leg_l_back' },
  LEG_L_RIGHT: { x: 16, y: 52, width: 4, height: 12, name: 'leg_l_right' },
  LEG_L_LEFT: { x: 24, y: 52, width: 4, height: 12, name: 'leg_l_left' },
  LEG_L_TOP: { x: 20, y: 48, width: 4, height: 4, name: 'leg_l_top' },
  LEG_L_BOTTOM: { x: 24, y: 48, width: 4, height: 4, name: 'leg_l_bottom' },
} as const;

// ============================================================================
// BIBLIOTECA DE SPRITES - CABEZA BASE (PIEL)
// ============================================================================

/**
 * Generates base head sprite - All faces
 * Recolored with skinTone
 */
export function generateHead_Base_01(): string {
  return `
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
      <!-- HEAD_TOP (8x8) at (8,0) - Cabeza superior -->
      <rect x="8" y="0" width="1" height="1" fill="#20150d" class="colorizable-skin"/>
      <rect x="9" y="0" width="1" height="1" fill="#291c11" class="colorizable-skin"/>
      <rect x="10" y="0" width="1" height="1" fill="#2c1e11" class="colorizable-skin"/>
      <rect x="11" y="0" width="1" height="1" fill="#271a11" class="colorizable-skin"/>
      <rect x="12" y="0" width="1" height="1" fill="#2b1f12" class="colorizable-skin"/>
      <rect x="13" y="0" width="1" height="1" fill="#271b10" class="colorizable-skin"/>
      <rect x="14" y="0" width="1" height="1" fill="#291c11" class="colorizable-skin"/>
      <rect x="15" y="0" width="1" height="1" fill="#25190f" class="colorizable-skin"/>
      <rect x="8" y="1" width="1" height="1" fill="#25180f" class="colorizable-skin"/>
      <rect x="9" y="1" width="1" height="1" fill="#302113" class="colorizable-skin"/>
      <rect x="10" y="1" width="1" height="1" fill="#1f150c" class="colorizable-skin"/>
      <rect x="11" y="1" width="1" height="1" fill="#23180f" class="colorizable-skin"/>
      <rect x="12" y="1" width="1" height="1" fill="#21150e" class="colorizable-skin"/>
      <rect x="13" y="1" width="1" height="1" fill="#1f170d" class="colorizable-skin"/>
      <rect x="14" y="1" width="1" height="1" fill="#291c11" class="colorizable-skin"/>
      <rect x="15" y="1" width="1" height="1" fill="#2c1e13" class="colorizable-skin"/>
      <rect x="8" y="2" width="1" height="1" fill="#281b11" class="colorizable-skin"/>
      <rect x="9" y="2" width="1" height="1" fill="#291c11" class="colorizable-skin"/>
      <rect x="10" y="2" width="1" height="1" fill="#281b11" class="colorizable-skin"/>
      <rect x="11" y="2" width="1" height="1" fill="#291a10" class="colorizable-skin"/>
      <rect x="12" y="2" width="1" height="1" fill="#291c12" class="colorizable-skin"/>
      <rect x="13" y="2" width="1" height="1" fill="#1e160d" class="colorizable-skin"/>
      <rect x="14" y="2" width="1" height="1" fill="#2e1e13" class="colorizable-skin"/>
      <rect x="15" y="2" width="1" height="1" fill="#302114" class="colorizable-skin"/>
      <rect x="8" y="3" width="1" height="1" fill="#302013" class="colorizable-skin"/>
      <rect x="9" y="3" width="1" height="1" fill="#24190e" class="colorizable-skin"/>
      <rect x="10" y="3" width="1" height="1" fill="#21180f" class="colorizable-skin"/>
      <rect x="11" y="3" width="1" height="1" fill="#27190f" class="colorizable-skin"/>
      <rect x="12" y="3" width="1" height="1" fill="#291d12" class="colorizable-skin"/>
      <rect x="13" y="3" width="1" height="1" fill="#291c10" class="colorizable-skin"/>
      <rect x="14" y="3" width="1" height="1" fill="#271a11" class="colorizable-skin"/>
      <rect x="15" y="3" width="1" height="1" fill="#2e1e15" class="colorizable-skin"/>
      <rect x="8" y="4" width="1" height="1" fill="#22160f" class="colorizable-skin"/>
      <rect x="9" y="4" width="1" height="1" fill="#261a10" class="colorizable-skin"/>
      <rect x="10" y="4" width="1" height="1" fill="#231a0f" class="colorizable-skin"/>
      <rect x="11" y="4" width="1" height="1" fill="#281a0f" class="colorizable-skin"/>
      <rect x="12" y="4" width="1" height="1" fill="#261a10" class="colorizable-skin"/>
      <rect x="13" y="4" width="1" height="1" fill="#2e1d14" class="colorizable-skin"/>
      <rect x="14" y="4" width="1" height="1" fill="#2e2014" class="colorizable-skin"/>
      <rect x="15" y="4" width="1" height="1" fill="#2d1f11" class="colorizable-skin"/>
      <rect x="8" y="5" width="1" height="1" fill="#2d1f14" class="colorizable-skin"/>
      <rect x="9" y="5" width="1" height="1" fill="#291c11" class="colorizable-skin"/>
      <rect x="10" y="5" width="1" height="1" fill="#2d1e13" class="colorizable-skin"/>
      <rect x="11" y="5" width="1" height="1" fill="#251a11" class="colorizable-skin"/>
      <rect x="12" y="5" width="1" height="1" fill="#281b11" class="colorizable-skin"/>
      <rect x="13" y="5" width="1" height="1" fill="#2a1b11" class="colorizable-skin"/>
      <rect x="14" y="5" width="1" height="1" fill="#2b1d12" class="colorizable-skin"/>
      <rect x="15" y="5" width="1" height="1" fill="#2b1c12" class="colorizable-skin"/>
      <rect x="8" y="6" width="1" height="1" fill="#24180f" class="colorizable-skin"/>
      <rect x="9" y="6" width="1" height="1" fill="#2b1e11" class="colorizable-skin"/>
      <rect x="10" y="6" width="1" height="1" fill="#251a0f" class="colorizable-skin"/>
      <rect x="11" y="6" width="1" height="1" fill="#271c12" class="colorizable-skin"/>
      <rect x="12" y="6" width="1" height="1" fill="#322416" class="colorizable-skin"/>
      <rect x="13" y="6" width="1" height="1" fill="#2a1c11" class="colorizable-skin"/>
      <rect x="14" y="6" width="1" height="1" fill="#2b1f10" class="colorizable-skin"/>
      <rect x="15" y="6" width="1" height="1" fill="#24190d" class="colorizable-skin"/>
      <rect x="8" y="7" width="1" height="1" fill="#372617" class="colorizable-skin"/>
      <rect x="9" y="7" width="1" height="1" fill="#22180f" class="colorizable-skin"/>
      <rect x="10" y="7" width="1" height="1" fill="#3a2718" class="colorizable-skin"/>
      <rect x="11" y="7" width="1" height="1" fill="#22170e" class="colorizable-skin"/>
      <rect x="12" y="7" width="1" height="1" fill="#251710" class="colorizable-skin"/>
      <rect x="13" y="7" width="1" height="1" fill="#2a1c10" class="colorizable-skin"/>
      <rect x="14" y="7" width="1" height="1" fill="#261910" class="colorizable-skin"/>
      <rect x="15" y="7" width="1" height="1" fill="#2e1f15" class="colorizable-skin"/>

      <!-- HEAD_BOTTOM (8x8) at (16,0) - Cabeza inferior -->
      <rect x="16" y="0" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="17" y="0" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="18" y="0" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="19" y="0" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="20" y="0" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="21" y="0" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="22" y="0" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="23" y="0" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="16" y="1" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="17" y="1" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="18" y="1" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="19" y="1" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="20" y="1" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="21" y="1" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="22" y="1" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="23" y="1" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="16" y="2" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="17" y="2" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="18" y="2" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="19" y="2" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="20" y="2" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="21" y="2" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="22" y="2" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="23" y="2" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="16" y="3" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="17" y="3" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="18" y="3" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="19" y="3" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="20" y="3" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="21" y="3" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="22" y="3" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="23" y="3" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="16" y="4" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="17" y="4" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="18" y="4" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="19" y="4" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="20" y="4" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="21" y="4" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="22" y="4" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="23" y="4" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="16" y="5" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="17" y="5" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="18" y="5" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="19" y="5" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="20" y="5" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="21" y="5" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="22" y="5" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="23" y="5" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="16" y="6" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="17" y="6" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="18" y="6" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="19" y="6" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="20" y="6" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="21" y="6" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="22" y="6" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="23" y="6" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="16" y="7" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="17" y="7" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="18" y="7" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="19" y="7" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="20" y="7" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="21" y="7" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="22" y="7" width="1" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="23" y="7" width="1" height="1" fill="#706253" class="colorizable-skin"/>

      <!-- HEAD_RIGHT (8x8) at (0,8) - Cabeza derecha -->
      <rect x="0" y="8" width="1" height="1" fill="#2d1f12" class="colorizable-skin"/>
      <rect x="1" y="8" width="1" height="1" fill="#22180d" class="colorizable-skin"/>
      <rect x="2" y="8" width="1" height="1" fill="#2c1d12" class="colorizable-skin"/>
      <rect x="3" y="8" width="1" height="1" fill="#2a1c11" class="colorizable-skin"/>
      <rect x="4" y="8" width="1" height="1" fill="#281c12" class="colorizable-skin"/>
      <rect x="5" y="8" width="1" height="1" fill="#2b1d12" class="colorizable-skin"/>
      <rect x="6" y="8" width="1" height="1" fill="#342216" class="colorizable-skin"/>
      <rect x="7" y="8" width="1" height="1" fill="#2d1f13" class="colorizable-skin"/>
      <rect x="0" y="9" width="1" height="1" fill="#2a1c11" class="colorizable-skin"/>
      <rect x="1" y="9" width="1" height="1" fill="#291c12" class="colorizable-skin"/>
      <rect x="2" y="9" width="1" height="1" fill="#261a10" class="colorizable-skin"/>
      <rect x="3" y="9" width="1" height="1" fill="#22170c" class="colorizable-skin"/>
      <rect x="4" y="9" width="1" height="1" fill="#271a10" class="colorizable-skin"/>
      <rect x="5" y="9" width="1" height="1" fill="#2f2113" class="colorizable-skin"/>
      <rect x="6" y="9" width="1" height="1" fill="#342615" class="colorizable-skin"/>
      <rect x="7" y="9" width="1" height="1" fill="#2c1f11" class="colorizable-skin"/>
      <rect x="0" y="10" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="1" y="10" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="2" y="10" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="3" y="10" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="4" y="10" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="5" y="10" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="6" y="10" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="7" y="10" width="1" height="1" fill="#171308" class="colorizable-skin"/>
      <rect x="0" y="11" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="1" y="11" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="2" y="11" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="3" y="11" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="4" y="11" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="5" y="11" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="6" y="11" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="7" y="11" width="1" height="1" fill="#8b7a68" class="colorizable-skin"/>
      <rect x="0" y="12" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="1" y="12" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="2" y="12" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="3" y="12" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="4" y="12" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="5" y="12" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="6" y="12" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="7" y="12" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="0" y="13" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="1" y="13" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="2" y="13" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="3" y="13" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="4" y="13" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="5" y="13" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="6" y="13" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="7" y="13" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="0" y="14" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="1" y="14" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="2" y="14" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="3" y="14" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="4" y="14" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="5" y="14" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="6" y="14" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="7" y="14" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="0" y="15" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="1" y="15" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="2" y="15" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="3" y="15" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="4" y="15" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="5" y="15" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="6" y="15" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="7" y="15" width="1" height="1" fill="#80705f" class="colorizable-skin"/>

      <!-- HEAD_FRONT (8x8) at (8,8) - Cabeza frontal -->
      <rect x="8" y="8" width="1" height="1" fill="#2e2014" class="colorizable-skin"/>
      <rect x="9" y="8" width="1" height="1" fill="#261a11" class="colorizable-skin"/>
      <rect x="10" y="8" width="1" height="1" fill="#261a10" class="colorizable-skin"/>
      <rect x="11" y="8" width="1" height="1" fill="#3b2918" class="colorizable-skin"/>
      <rect x="12" y="8" width="1" height="1" fill="#2c2012" class="colorizable-skin"/>
      <rect x="13" y="8" width="1" height="1" fill="#231910" class="colorizable-skin"/>
      <rect x="14" y="8" width="1" height="1" fill="#3b2918" class="colorizable-skin"/>
      <rect x="15" y="8" width="1" height="1" fill="#2e2014" class="colorizable-skin"/>
      <rect x="8" y="9" width="1" height="1" fill="#6a5d50" class="colorizable-skin"/>
      <rect x="9" y="9" width="1" height="1" fill="#6a5d50" class="colorizable-skin"/>
      <rect x="10" y="9" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="11" y="9" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="12" y="9" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="13" y="9" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="14" y="9" width="1" height="1" fill="#6a5d50" class="colorizable-skin"/>
      <rect x="15" y="9" width="1" height="1" fill="#291910" class="colorizable-skin"/>
      <rect x="8" y="10" width="1" height="1" fill="#6a5d50" class="colorizable-skin"/>
      <rect x="9" y="10" width="1" height="1" fill="#092309" class="colorizable-skin"/>
      <rect x="10" y="10" width="1" height="1" fill="#092309" class="colorizable-skin"/>
      <rect x="11" y="10" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="12" y="10" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="13" y="10" width="1" height="1" fill="#092309" class="colorizable-skin"/>
      <rect x="14" y="10" width="1" height="1" fill="#092309" class="colorizable-skin"/>
      <rect x="15" y="10" width="1" height="1" fill="#6a5d50" class="colorizable-skin"/>
      <rect x="8" y="11" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="9" y="11" width="1" height="1" fill="#ffffff" class="colorizable-skin"/>
      <rect x="10" y="11" width="1" height="1" fill="#114611" class="colorizable-skin"/>
      <rect x="11" y="11" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="12" y="11" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="13" y="11" width="1" height="1" fill="#114611" class="colorizable-skin"/>
      <rect x="14" y="11" width="1" height="1" fill="#ffffff" class="colorizable-skin"/>
      <rect x="15" y="11" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="8" y="12" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="9" y="12" width="1" height="1" fill="#ffffff" class="colorizable-skin"/>
      <rect x="10" y="12" width="1" height="1" fill="#114611" class="colorizable-skin"/>
      <rect x="11" y="12" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="12" y="12" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="13" y="12" width="1" height="1" fill="#114611" class="colorizable-skin"/>
      <rect x="14" y="12" width="1" height="1" fill="#ffffff" class="colorizable-skin"/>
      <rect x="15" y="12" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="8" y="13" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="9" y="13" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="10" y="13" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="11" y="13" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="12" y="13" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="13" y="13" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="14" y="13" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="15" y="13" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="8" y="14" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="9" y="14" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="10" y="14" width="1" height="1" fill="#303030" class="colorizable-skin"/>
      <rect x="11" y="14" width="1" height="1" fill="#303030" class="colorizable-skin"/>
      <rect x="12" y="14" width="1" height="1" fill="#303030" class="colorizable-skin"/>
      <rect x="13" y="14" width="1" height="1" fill="#303030" class="colorizable-skin"/>
      <rect x="14" y="14" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="15" y="14" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="8" y="15" width="1" height="1" fill="#6a5d50" class="colorizable-skin"/>
      <rect x="9" y="15" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="10" y="15" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="11" y="15" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="12" y="15" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="13" y="15" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="14" y="15" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="15" y="15" width="1" height="1" fill="#6a5d50" class="colorizable-skin"/>

      <!-- HEAD_LEFT (8x8) at (16,8) - Cabeza izquierda -->
      <rect x="16" y="8" width="1" height="1" fill="#291b11" class="colorizable-skin"/>
      <rect x="17" y="8" width="1" height="1" fill="#291c12" class="colorizable-skin"/>
      <rect x="18" y="8" width="1" height="1" fill="#261b12" class="colorizable-skin"/>
      <rect x="19" y="8" width="1" height="1" fill="#312214" class="colorizable-skin"/>
      <rect x="20" y="8" width="1" height="1" fill="#281c11" class="colorizable-skin"/>
      <rect x="21" y="8" width="1" height="1" fill="#302215" class="colorizable-skin"/>
      <rect x="22" y="8" width="1" height="1" fill="#261c11" class="colorizable-skin"/>
      <rect x="23" y="8" width="1" height="1" fill="#25190e" class="colorizable-skin"/>
      <rect x="16" y="9" width="1" height="1" fill="#281d11" class="colorizable-skin"/>
      <rect x="17" y="9" width="1" height="1" fill="#261a0f" class="colorizable-skin"/>
      <rect x="18" y="9" width="1" height="1" fill="#312112" class="colorizable-skin"/>
      <rect x="19" y="9" width="1" height="1" fill="#2d1f13" class="colorizable-skin"/>
      <rect x="20" y="9" width="1" height="1" fill="#2e1f12" class="colorizable-skin"/>
      <rect x="21" y="9" width="1" height="1" fill="#352516" class="colorizable-skin"/>
      <rect x="22" y="9" width="1" height="1" fill="#24180e" class="colorizable-skin"/>
      <rect x="23" y="9" width="1" height="1" fill="#312014" class="colorizable-skin"/>
      <rect x="16" y="10" width="1" height="1" fill="#20170f" class="colorizable-skin"/>
      <rect x="17" y="10" width="1" height="1" fill="#2c1d10" class="colorizable-skin"/>
      <rect x="18" y="10" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="19" y="10" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="20" y="10" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="21" y="10" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="22" y="10" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="23" y="10" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="16" y="11" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="17" y="11" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="18" y="11" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="19" y="11" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="20" y="11" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="21" y="11" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="22" y="11" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="23" y="11" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="16" y="12" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="17" y="12" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="18" y="12" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="19" y="12" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="20" y="12" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="21" y="12" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="22" y="12" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="23" y="12" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="16" y="13" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="17" y="13" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="18" y="13" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="19" y="13" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="20" y="13" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="21" y="13" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="22" y="13" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="23" y="13" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="16" y="14" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="17" y="14" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="18" y="14" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="19" y="14" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="20" y="14" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="21" y="14" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="22" y="14" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="23" y="14" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="16" y="15" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="17" y="15" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="18" y="15" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="19" y="15" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="20" y="15" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="21" y="15" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="22" y="15" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="23" y="15" width="1" height="1" fill="#80705f" class="colorizable-skin"/>

      <!-- HEAD_BACK (8x8) at (24,8) - Cabeza trasera -->
      <rect x="24" y="8" width="1" height="1" fill="#1f160d" class="colorizable-skin"/>
      <rect x="25" y="8" width="1" height="1" fill="#20150d" class="colorizable-skin"/>
      <rect x="26" y="8" width="1" height="1" fill="#261b0f" class="colorizable-skin"/>
      <rect x="27" y="8" width="1" height="1" fill="#2d1e14" class="colorizable-skin"/>
      <rect x="28" y="8" width="1" height="1" fill="#2a1c12" class="colorizable-skin"/>
      <rect x="29" y="8" width="1" height="1" fill="#291c11" class="colorizable-skin"/>
      <rect x="30" y="8" width="1" height="1" fill="#2d1e13" class="colorizable-skin"/>
      <rect x="31" y="8" width="1" height="1" fill="#21170e" class="colorizable-skin"/>
      <rect x="24" y="9" width="1" height="1" fill="#261a11" class="colorizable-skin"/>
      <rect x="25" y="9" width="1" height="1" fill="#2f1f13" class="colorizable-skin"/>
      <rect x="26" y="9" width="1" height="1" fill="#271b11" class="colorizable-skin"/>
      <rect x="27" y="9" width="1" height="1" fill="#2c1f12" class="colorizable-skin"/>
      <rect x="28" y="9" width="1" height="1" fill="#322215" class="colorizable-skin"/>
      <rect x="29" y="9" width="1" height="1" fill="#271c11" class="colorizable-skin"/>
      <rect x="30" y="9" width="1" height="1" fill="#22170f" class="colorizable-skin"/>
      <rect x="31" y="9" width="1" height="1" fill="#2f1e13" class="colorizable-skin"/>
      <rect x="24" y="10" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="25" y="10" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="26" y="10" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="27" y="10" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="28" y="10" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="29" y="10" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="30" y="10" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="31" y="10" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="24" y="11" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="25" y="11" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="26" y="11" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="27" y="11" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="28" y="11" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="29" y="11" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="30" y="11" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="31" y="11" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="24" y="12" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="25" y="12" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="26" y="12" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="27" y="12" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="28" y="12" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="29" y="12" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="30" y="12" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="31" y="12" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="24" y="13" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="25" y="13" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="26" y="13" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="27" y="13" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="28" y="13" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="29" y="13" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="30" y="13" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="31" y="13" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="24" y="14" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="25" y="14" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="26" y="14" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="27" y="14" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="28" y="14" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="29" y="14" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="30" y="14" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="31" y="14" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="24" y="15" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="25" y="15" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="26" y="15" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="27" y="15" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="28" y="15" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="29" y="15" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="30" y="15" width="1" height="1" fill="#66564a" class="colorizable-skin"/>
      <rect x="31" y="15" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
    </svg>
  `;
}

/**
 * Generates head sprite with Buzz Cut (shaved hair painted directly)
 * For very short military cuts where the hair is painted on HEAD_TOP
 * Recolored with skinTone and hairColor
 */
export function generateHead_BuzzCut(): string {
  return `
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
      <!-- HEAD_TOP (8x8) at (8,0) - Cabeza superior con textura de pelo rapado -->
      <!-- Pelo rapado con textura irregular marrón/grisáceo mezclado con beige de piel -->
      <rect x="8" y="0" width="1" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="9" y="0" width="1" height="1" fill="#5d5347" class="colorizable-hair"/>
      <rect x="10" y="0" width="1" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="11" y="0" width="1" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="12" y="0" width="1" height="1" fill="#5d5347" class="colorizable-hair"/>
      <rect x="13" y="0" width="1" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="14" y="0" width="1" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="15" y="0" width="1" height="1" fill="#5d5347" class="colorizable-hair"/>
      <rect x="8" y="1" width="1" height="1" fill="#5d5347" class="colorizable-hair"/>
      <rect x="9" y="1" width="1" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="10" y="1" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="11" y="1" width="1" height="1" fill="#5d5347" class="colorizable-hair"/>
      <rect x="12" y="1" width="1" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="13" y="1" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="14" y="1" width="1" height="1" fill="#5d5347" class="colorizable-hair"/>
      <rect x="15" y="1" width="1" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="8" y="2" width="1" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="9" y="2" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="10" y="2" width="1" height="1" fill="#5d5347" class="colorizable-hair"/>
      <rect x="11" y="2" width="1" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="12" y="2" width="1" height="1" fill="#5d5347" class="colorizable-hair"/>
      <rect x="13" y="2" width="1" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="14" y="2" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="15" y="2" width="1" height="1" fill="#5d5347" class="colorizable-hair"/>
      <rect x="8" y="3" width="1" height="1" fill="#5d5347" class="colorizable-hair"/>
      <rect x="9" y="3" width="1" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="10" y="3" width="1" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="11" y="3" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="12" y="3" width="1" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="13" y="3" width="1" height="1" fill="#5d5347" class="colorizable-hair"/>
      <rect x="14" y="3" width="1" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="15" y="3" width="1" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="8" y="4" width="1" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="9" y="4" width="1" height="1" fill="#5d5347" class="colorizable-hair"/>
      <rect x="10" y="4" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="11" y="4" width="1" height="1" fill="#5d5347" class="colorizable-hair"/>
      <rect x="12" y="4" width="1" height="1" fill="#5d5347" class="colorizable-hair"/>
      <rect x="13" y="4" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="14" y="4" width="1" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="15" y="4" width="1" height="1" fill="#5d5347" class="colorizable-hair"/>
      <rect x="8" y="5" width="1" height="1" fill="#5d5347" class="colorizable-hair"/>
      <rect x="9" y="5" width="1" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="10" y="5" width="1" height="1" fill="#5d5347" class="colorizable-hair"/>
      <rect x="11" y="5" width="1" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="12" y="5" width="1" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="13" y="5" width="1" height="1" fill="#5d5347" class="colorizable-hair"/>
      <rect x="14" y="5" width="1" height="1" fill="#5d5347" class="colorizable-hair"/>
      <rect x="15" y="5" width="1" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="8" y="6" width="1" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="9" y="6" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="10" y="6" width="1" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="11" y="6" width="1" height="1" fill="#5d5347" class="colorizable-hair"/>
      <rect x="12" y="6" width="1" height="1" fill="#5d5347" class="colorizable-hair"/>
      <rect x="13" y="6" width="1" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="14" y="6" width="1" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="15" y="6" width="1" height="1" fill="#5d5347" class="colorizable-hair"/>
      <rect x="8" y="7" width="1" height="1" fill="#5d5347" class="colorizable-hair"/>
      <rect x="9" y="7" width="1" height="1" fill="#5d5347" class="colorizable-hair"/>
      <rect x="10" y="7" width="1" height="1" fill="#5d5347" class="colorizable-hair"/>
      <rect x="11" y="7" width="1" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="12" y="7" width="1" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="13" y="7" width="1" height="1" fill="#5d5347" class="colorizable-hair"/>
      <rect x="14" y="7" width="1" height="1" fill="#5d5347" class="colorizable-hair"/>
      <rect x="15" y="7" width="1" height="1" fill="#4a3f35" class="colorizable-hair"/>

      <!-- HEAD_BOTTOM (8x8) at (16,0) - Cabeza inferior -->
      <rect x="16" y="0" width="8" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="16" y="1" width="8" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="16" y="2" width="8" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="16" y="3" width="8" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="16" y="4" width="8" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="16" y="5" width="8" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="16" y="6" width="8" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="16" y="7" width="8" height="1" fill="#706253" class="colorizable-skin"/>

      <!-- HEAD_RIGHT (8x8) at (0,8) - Cabeza derecha con línea de pelo arriba -->
      <rect x="0" y="8" width="8" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="0" y="9" width="8" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="0" y="10" width="8" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="0" y="11" width="8" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="0" y="12" width="8" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="0" y="13" width="8" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="0" y="14" width="8" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="0" y="15" width="8" height="1" fill="#706253" class="colorizable-skin"/>

      <!-- HEAD_FRONT (8x8) at (8,8) - Cabeza frontal con línea de pelo arriba -->
      <rect x="8" y="8" width="8" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="8" y="9" width="2" height="1" fill="#6a5d50" class="colorizable-skin"/>
      <rect x="10" y="9" width="4" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="14" y="9" width="2" height="1" fill="#6a5d50" class="colorizable-skin"/>
      <rect x="8" y="10" width="1" height="1" fill="#6a5d50" class="colorizable-skin"/>
      <rect x="9" y="10" width="6" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="15" y="10" width="1" height="1" fill="#6a5d50" class="colorizable-skin"/>
      <rect x="8" y="11" width="8" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="8" y="12" width="8" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="8" y="13" width="8" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="8" y="14" width="2" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="10" y="14" width="4" height="1" fill="#303030"/>
      <rect x="14" y="14" width="2" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="8" y="15" width="1" height="1" fill="#6a5d50" class="colorizable-skin"/>
      <rect x="9" y="15" width="6" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="15" y="15" width="1" height="1" fill="#6a5d50" class="colorizable-skin"/>

      <!-- HEAD_LEFT (8x8) at (16,8) - Cabeza izquierda con línea de pelo arriba -->
      <rect x="16" y="8" width="8" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="16" y="9" width="8" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="16" y="10" width="8" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="16" y="11" width="8" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="16" y="12" width="8" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="16" y="13" width="8" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="16" y="14" width="8" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="16" y="15" width="8" height="1" fill="#706253" class="colorizable-skin"/>

      <!-- HEAD_BACK (8x8) at (24,8) - Cabeza trasera con línea de pelo arriba -->
      <rect x="24" y="8" width="8" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="24" y="9" width="8" height="1" fill="#4a3f35" class="colorizable-hair"/>
      <rect x="24" y="10" width="8" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="24" y="11" width="8" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="24" y="12" width="8" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="24" y="13" width="8" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="24" y="14" width="8" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="24" y="15" width="8" height="1" fill="#706253" class="colorizable-skin"/>
    </svg>
  `;
}

export function generateHead_Female_01(): string {
  return `
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
      <!-- HEAD_TOP (8x8) at (8,0) - Cabeza superior -->
      <rect x="8" y="0" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="9" y="0" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="10" y="0" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="11" y="0" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="12" y="0" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="13" y="0" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="14" y="0" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="15" y="0" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="8" y="1" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="9" y="1" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="10" y="1" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="11" y="1" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="12" y="1" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="13" y="1" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="14" y="1" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="15" y="1" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="8" y="2" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="9" y="2" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="10" y="2" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="11" y="2" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="12" y="2" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="13" y="2" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="14" y="2" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="15" y="2" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="8" y="3" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="9" y="3" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="10" y="3" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="11" y="3" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="12" y="3" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="13" y="3" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="14" y="3" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="15" y="3" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="8" y="4" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="9" y="4" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="10" y="4" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="11" y="4" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="12" y="4" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="13" y="4" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="14" y="4" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="15" y="4" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="8" y="5" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="9" y="5" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="10" y="5" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="11" y="5" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="12" y="5" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="13" y="5" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="14" y="5" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="15" y="5" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="8" y="6" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="9" y="6" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="10" y="6" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="11" y="6" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="12" y="6" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="13" y="6" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="14" y="6" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="15" y="6" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="8" y="7" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="9" y="7" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="10" y="7" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="11" y="7" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="12" y="7" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="13" y="7" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="14" y="7" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="15" y="7" width="1" height="1" fill="#523d42" class="colorizable-skin"/>

      <!-- HEAD_BOTTOM (8x8) at (16,0) - Cabeza inferior -->
      <rect x="16" y="0" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="17" y="0" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="18" y="0" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="19" y="0" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="20" y="0" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="21" y="0" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="22" y="0" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="23" y="0" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="16" y="1" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="17" y="1" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="18" y="1" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="19" y="1" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="20" y="1" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="21" y="1" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="22" y="1" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="23" y="1" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="16" y="2" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="17" y="2" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="18" y="2" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="19" y="2" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="20" y="2" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="21" y="2" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="22" y="2" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="23" y="2" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="16" y="3" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="17" y="3" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="18" y="3" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="19" y="3" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="20" y="3" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="21" y="3" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="22" y="3" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="23" y="3" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="16" y="4" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="17" y="4" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="18" y="4" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="19" y="4" width="1" height="1" fill="#fde4d3" class="colorizable-skin"/>
      <rect x="20" y="4" width="1" height="1" fill="#fde4d3" class="colorizable-skin"/>
      <rect x="21" y="4" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="22" y="4" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="23" y="4" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="16" y="5" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="17" y="5" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="18" y="5" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="19" y="5" width="1" height="1" fill="#fde4d3" class="colorizable-skin"/>
      <rect x="20" y="5" width="1" height="1" fill="#fde4d3" class="colorizable-skin"/>
      <rect x="21" y="5" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="22" y="5" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="23" y="5" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="16" y="6" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="17" y="6" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="18" y="6" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="19" y="6" width="1" height="1" fill="#fde4d3" class="colorizable-skin"/>
      <rect x="20" y="6" width="1" height="1" fill="#fde4d3" class="colorizable-skin"/>
      <rect x="21" y="6" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="22" y="6" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="23" y="6" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="16" y="7" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="17" y="7" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="18" y="7" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="19" y="7" width="1" height="1" fill="#fde4d3" class="colorizable-skin"/>
      <rect x="20" y="7" width="1" height="1" fill="#fde4d3" class="colorizable-skin"/>
      <rect x="21" y="7" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="22" y="7" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="23" y="7" width="1" height="1" fill="#523d42" class="colorizable-skin"/>

      <!-- HEAD_RIGHT (8x8) at (0,8) - Cabeza derecha -->
      <rect x="0" y="8" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="1" y="8" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="2" y="8" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="3" y="8" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="4" y="8" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="5" y="8" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="6" y="8" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="7" y="8" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="0" y="9" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="1" y="9" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="2" y="9" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="3" y="9" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="4" y="9" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="5" y="9" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="6" y="9" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="7" y="9" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="0" y="10" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="1" y="10" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="2" y="10" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="3" y="10" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="4" y="10" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="5" y="10" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="6" y="10" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="7" y="10" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="0" y="11" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="1" y="11" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="2" y="11" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="3" y="11" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="4" y="11" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="5" y="11" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="6" y="11" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="7" y="11" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="0" y="12" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="1" y="12" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="2" y="12" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="3" y="12" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="4" y="12" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="5" y="12" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="6" y="12" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="7" y="12" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="0" y="13" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="1" y="13" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="2" y="13" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="3" y="13" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="4" y="13" width="1" height="1" fill="#5f5345" class="colorizable-skin"/>
      <rect x="5" y="13" width="1" height="1" fill="#363941" class="colorizable-skin"/>
      <rect x="6" y="13" width="1" height="1" fill="#363941" class="colorizable-skin"/>
      <rect x="7" y="13" width="1" height="1" fill="#3f2e27" class="colorizable-skin"/>
      <rect x="0" y="14" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="1" y="14" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="2" y="14" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="3" y="14" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="4" y="14" width="1" height="1" fill="#e7a79d" class="colorizable-skin"/>
      <rect x="5" y="14" width="1" height="1" fill="#b37971" class="colorizable-skin"/>
      <rect x="6" y="14" width="1" height="1" fill="#363941" class="colorizable-skin"/>
      <rect x="7" y="14" width="1" height="1" fill="#3f2e27" class="colorizable-skin"/>
      <rect x="0" y="15" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="1" y="15" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="2" y="15" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="3" y="15" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="4" y="15" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="5" y="15" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="6" y="15" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="7" y="15" width="1" height="1" fill="#523d42" class="colorizable-skin"/>

      <!-- HEAD_FRONT (8x8) at (8,8) - Cabeza frontal -->
      <rect x="8" y="8" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="9" y="8" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="10" y="8" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="11" y="8" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="12" y="8" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="13" y="8" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="14" y="8" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="15" y="8" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="8" y="9" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="9" y="9" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="10" y="9" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="11" y="9" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="12" y="9" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="13" y="9" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="14" y="9" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="15" y="9" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="8" y="10" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="9" y="10" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="10" y="10" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="11" y="10" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="12" y="10" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="13" y="10" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="14" y="10" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="15" y="10" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="8" y="11" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="9" y="11" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="10" y="11" width="1" height="1" fill="#fde4d3" class="colorizable-skin"/>
      <rect x="11" y="11" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="12" y="11" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="13" y="11" width="1" height="1" fill="#fde4d3" class="colorizable-skin"/>
      <rect x="14" y="11" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="15" y="11" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="8" y="12" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="9" y="12" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="10" y="12" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="11" y="12" width="1" height="1" fill="#fde4d3" class="colorizable-skin"/>
      <rect x="12" y="12" width="1" height="1" fill="#fde4d3" class="colorizable-skin"/>
      <rect x="13" y="12" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="14" y="12" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="15" y="12" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="8" y="13" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="9" y="13" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="10" y="13" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="11" y="13" width="1" height="1" fill="#fde4d3" class="colorizable-skin"/>
      <rect x="12" y="13" width="1" height="1" fill="#fde4d3" class="colorizable-skin"/>
      <rect x="13" y="13" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="14" y="13" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="15" y="13" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="8" y="14" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="9" y="14" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="10" y="14" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="11" y="14" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="12" y="14" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="13" y="14" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="14" y="14" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="15" y="14" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="8" y="15" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="9" y="15" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="10" y="15" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="11" y="15" width="1" height="1" fill="#fde4d3" class="colorizable-skin"/>
      <rect x="12" y="15" width="1" height="1" fill="#fde4d3" class="colorizable-skin"/>
      <rect x="13" y="15" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="14" y="15" width="1" height="1" fill="#fddbc4" class="colorizable-skin"/>
      <rect x="15" y="15" width="1" height="1" fill="#523d42" class="colorizable-skin"/>

      <!-- HEAD_LEFT (8x8) at (16,8) - Cabeza izquierda -->
      <rect x="16" y="8" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="17" y="8" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="18" y="8" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="19" y="8" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="20" y="8" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="21" y="8" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="22" y="8" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="23" y="8" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="16" y="9" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="17" y="9" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="18" y="9" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="19" y="9" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="20" y="9" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="21" y="9" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="22" y="9" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="23" y="9" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="16" y="10" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="17" y="10" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="18" y="10" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="19" y="10" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="20" y="10" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="21" y="10" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="22" y="10" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="23" y="10" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="16" y="11" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="17" y="11" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="18" y="11" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="19" y="11" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="20" y="11" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="21" y="11" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="22" y="11" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="23" y="11" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="16" y="12" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="17" y="12" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="18" y="12" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="19" y="12" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="20" y="12" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="21" y="12" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="22" y="12" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="23" y="12" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="16" y="13" width="1" height="1" fill="#3f2e27" class="colorizable-skin"/>
      <rect x="17" y="13" width="1" height="1" fill="#363941" class="colorizable-skin"/>
      <rect x="18" y="13" width="1" height="1" fill="#363941" class="colorizable-skin"/>
      <rect x="19" y="13" width="1" height="1" fill="#5f5345" class="colorizable-skin"/>
      <rect x="20" y="13" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="21" y="13" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="22" y="13" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="23" y="13" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="16" y="14" width="1" height="1" fill="#3f2e27" class="colorizable-skin"/>
      <rect x="17" y="14" width="1" height="1" fill="#363941" class="colorizable-skin"/>
      <rect x="18" y="14" width="1" height="1" fill="#b37971" class="colorizable-skin"/>
      <rect x="19" y="14" width="1" height="1" fill="#e7a79d" class="colorizable-skin"/>
      <rect x="20" y="14" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="21" y="14" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="22" y="14" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="23" y="14" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="16" y="15" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="17" y="15" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="18" y="15" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="19" y="15" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="20" y="15" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="21" y="15" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="22" y="15" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="23" y="15" width="1" height="1" fill="#523d42" class="colorizable-skin"/>

      <!-- HEAD_BACK (8x8) at (24,8) - Cabeza trasera -->
      <rect x="24" y="8" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="25" y="8" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="26" y="8" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="27" y="8" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="28" y="8" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="29" y="8" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="30" y="8" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="31" y="8" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="24" y="9" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="25" y="9" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="26" y="9" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="27" y="9" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="28" y="9" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="29" y="9" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="30" y="9" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="31" y="9" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="24" y="10" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="25" y="10" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="26" y="10" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="27" y="10" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="28" y="10" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="29" y="10" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="30" y="10" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="31" y="10" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="24" y="11" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="25" y="11" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="26" y="11" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="27" y="11" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="28" y="11" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="29" y="11" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="30" y="11" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="31" y="11" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="24" y="12" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="25" y="12" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="26" y="12" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="27" y="12" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="28" y="12" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="29" y="12" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="30" y="12" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="31" y="12" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="24" y="13" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="25" y="13" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="26" y="13" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="27" y="13" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="28" y="13" width="1" height="1" fill="#7f5955" class="colorizable-skin"/>
      <rect x="29" y="13" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="30" y="13" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="31" y="13" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="24" y="14" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="25" y="14" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="26" y="14" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="27" y="14" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="28" y="14" width="1" height="1" fill="#745251" class="colorizable-skin"/>
      <rect x="29" y="14" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="30" y="14" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="31" y="14" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="24" y="15" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="25" y="15" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="26" y="15" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="27" y="15" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="28" y="15" width="1" height="1" fill="#5f4747" class="colorizable-skin"/>
      <rect x="29" y="15" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="30" y="15" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
      <rect x="31" y="15" width="1" height="1" fill="#523d42" class="colorizable-skin"/>
    </svg>
  `;
}



// ============================================================================
// BIBLIOTECA DE SPRITES - OJOS
// ============================================================================

/**
 * Genera sprite de ojos - Tipo 1: Ojos grandes redondos
 */
export function generateEyes_01(): string {
  return `
    <svg width="8" height="8" xmlns="http://www.w3.org/2000/svg">
      <!-- Fondo transparente -->
      <rect width="8" height="8" fill="none"/>

      <!-- Ojo izquierdo (desde perspectiva del personaje) -->
      <!-- Blanco del ojo -->
      <rect x="1" y="3" width="2" height="2" fill="#FFFFFF"/>
      <!-- Pupila (se recolorea) -->
      <rect x="2" y="3" width="1" height="2" fill="#808080" class="colorizable-eye"/>

      <!-- Ojo derecho (desde perspectiva del personaje) -->
      <!-- Blanco del ojo -->
      <rect x="5" y="3" width="2" height="2" fill="#FFFFFF"/>
      <!-- Pupila (se recolorea) -->
      <rect x="5" y="3" width="1" height="2" fill="#808080" class="colorizable-eye"/>

      <!-- Sombra superior (párpados) -->
      <rect x="1" y="2" width="2" height="1" fill="#404040"/>
      <rect x="5" y="2" width="2" height="1" fill="#404040"/>
    </svg>
  `;
}

/**
 * Genera sprite de ojos - Tipo 2: Ojos entrecerrados
 */
export function generateEyes_02(): string {
  return `
    <svg width="8" height="8" xmlns="http://www.w3.org/2000/svg">
      <!-- Ojo izquierdo - entrecerrado -->
      <rect x="1" y="4" width="2" height="1" fill="#ffffff"/>
      <rect x="2" y="4" width="1" height="1" fill="#c9c9c9" class="colorizable-eye"/>

      <!-- Ojo derecho - entrecerrado -->
      <rect x="5" y="4" width="2" height="1" fill="#ffffff"/>
      <rect x="5" y="4" width="1" height="1" fill="#c9c9c9" class="colorizable-eye"/>
    </svg>
  `;
}

/** Generates eye sprite - Type 3: Big eyes with shine */
export function generateEyes_03(): string {
  return `
    <svg width="8" height="8" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <!-- Ojo izquierdo (x=1-2, y=2-4) -->
      <rect x="1" y="2" width="2" height="3" fill="#FFFFFF"/>
      <!-- Pupila en gris muy claro (E0E0E0) para que los colores se vean vibrantes -->
      <rect x="2" y="3" width="1" height="1" fill="#E0E0E0" class="colorizable-eye"/>
      <rect x="2" y="4" width="1" height="1" fill="#E0E0E0" class="colorizable-eye"/>

      <!-- Ojo derecho (x=5-6, y=2-4) -->
      <rect x="5" y="2" width="2" height="3" fill="#FFFFFF"/>
      <!-- Pupila en gris muy claro (E0E0E0) para que los colores se vean vibrantes -->
      <rect x="5" y="3" width="1" height="1" fill="#E0E0E0" class="colorizable-eye"/>
      <rect x="5" y="4" width="1" height="1" fill="#E0E0E0" class="colorizable-eye"/>
    </svg>
  `;
}

// ============================================================================
// BIBLIOTECA DE SPRITES - BOCAS
// ============================================================================

/** Generates mouth sprite - Type 1: Small smile */

/** Generates eye sprite for Lob - Only whites, outline, and iris */
export function generateEyes_Female_01(): string {
  return `
    <svg width="8" height="8" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <!-- Fila y=4: Contorno oscuro superior de ojos -->
      <rect x="1" y="4" width="1" height="1" fill="#3f2e27"/>
      <rect x="2" y="4" width="1" height="1" fill="#3f2e27"/>
      <rect x="5" y="4" width="1" height="1" fill="#3f2e27"/>
      <rect x="6" y="4" width="1" height="1" fill="#3f2e27"/>

      <!-- Fila y=5: Eyeliner + Blanco grisáceo + Iris azul -->
      <rect x="0" y="5" width="1" height="1" fill="#3f2e27"/>
      <rect x="1" y="5" width="1" height="1" fill="#e2d6cf"/>
      <rect x="2" y="5" width="1" height="1" fill="#395cc6"/>
      <rect x="5" y="5" width="1" height="1" fill="#395cc6"/>
      <rect x="6" y="5" width="1" height="1" fill="#e2d6cf"/>
      <rect x="7" y="5" width="1" height="1" fill="#3f2e27"/>

      <!-- Fila y=6: Eyeliner + Blanco + Iris azul -->
      <rect x="0" y="6" width="1" height="1" fill="#3f2e27"/>
      <rect x="1" y="6" width="1" height="1" fill="#fcf7f2"/>
      <rect x="2" y="6" width="1" height="1" fill="#395cc6"/>
      <rect x="5" y="6" width="1" height="1" fill="#395cc6"/>
      <rect x="6" y="6" width="1" height="1" fill="#fcf7f2"/>
      <rect x="7" y="6" width="1" height="1" fill="#3f2e27"/>
    </svg>
  `;
}

/** Generates empty mouth sprite for Lob */
export function generateMouth_Empty(): string {
  return `
    <svg width="8" height="8" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <!-- Sin boca -->
    </svg>
  `;
}

export function generateMouth_01(): string {
  return `
    <svg width="8" height="8" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <!-- Sonrisa simple (sin curva superior para evitar píxeles semi-transparentes) -->
      <rect x="2" y="6" width="1" height="1" fill="#303030"/>
      <rect x="3" y="6" width="2" height="1" fill="#303030"/>
      <rect x="5" y="6" width="1" height="1" fill="#303030"/>
    </svg>
  `;
}

/** Generates mouth sprite - Type 2: Neutral (line) */
export function generateMouth_02(): string {
  return `
    <svg width="8" height="8" xmlns="http://www.w3.org/2000/svg">
      <!-- Línea neutral -->
      <rect x="2" y="6" width="4" height="1" fill="#303030"/>
    </svg>
  `;
}

/**
 * Genera sprite de boca - Tipo 3: Sonrisa amplia
 */
export function generateMouth_03(): string {
  return `
    <svg width="8" height="8" xmlns="http://www.w3.org/2000/svg">
      <!-- Sonrisa amplia con dientes -->
      <rect x="1" y="6" width="6" height="1" fill="#303030"/>
      <rect x="2" y="5" width="4" height="1" fill="#FFFFFF"/>
      <!-- Sombra -->
      <rect x="1" y="5" width="1" height="1" fill="#202020" opacity="0.3"/>
      <rect x="6" y="5" width="1" height="1" fill="#202020" opacity="0.3"/>
    </svg>
  `;
}

// ============================================================================
// BIBLIOTECA DE SPRITES - PELO
// ============================================================================

/**
 * Generates full hair sprite - Type 1: Stylized short hair
 * Includes all faces of the hair layer (HAT layer)
 */
export function generateHairFront_01(): string {
  return `
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
      <!-- HAT_TOP (8x8) at (40,0) - Vista superior con volumen -->
      <rect x="40" y="0" width="8" height="8" fill="#808080" class="colorizable-hair"/>
      <rect x="41" y="0" width="6" height="1" fill="#909090" class="colorizable-hair"/>
      <!-- Línea central -->
      <rect x="43" y="1" width="2" height="6" fill="#707070" class="colorizable-hair" opacity="0.3"/>

      <!-- HAT_BOTTOM (8x8) at (48,0) - Vista inferior (vacío) -->

      <!-- HAT_RIGHT (8x8) at (32,8) - Lado derecho estilizado -->
      <!-- Base del pelo -->
      <rect x="32" y="8" width="8" height="2" fill="#808080" class="colorizable-hair"/>
      <!-- Mechones laterales -->
      <rect x="32" y="10" width="6" height="1" fill="#808080" class="colorizable-hair"/>
      <rect x="32" y="11" width="5" height="1" fill="#707070" class="colorizable-hair"/>
      <rect x="32" y="12" width="3" height="1" fill="#707070" class="colorizable-hair"/>
      <!-- Sombra -->
      <rect x="32" y="13" width="2" height="2" fill="#606060" class="colorizable-hair" opacity="0.5"/>

      <!-- HAT_FRONT (8x8) at (40,8) - Frente con flequillo -->
      <rect x="40" y="8" width="8" height="2" fill="#808080" class="colorizable-hair"/>
      <!-- Mechones del flequillo -->
      <rect x="41" y="10" width="2" height="1" fill="#707070" class="colorizable-hair"/>
      <rect x="45" y="10" width="2" height="1" fill="#707070" class="colorizable-hair"/>
      <!-- Puntas -->
      <rect x="41" y="11" width="1" height="1" fill="#606060" class="colorizable-hair"/>
      <rect x="46" y="11" width="1" height="1" fill="#606060" class="colorizable-hair"/>

      <!-- HAT_LEFT (8x8) at (48,8) - Lado izquierdo estilizado -->
      <!-- Base del pelo -->
      <rect x="48" y="8" width="8" height="2" fill="#808080" class="colorizable-hair"/>
      <!-- Mechones laterales -->
      <rect x="50" y="10" width="6" height="1" fill="#808080" class="colorizable-hair"/>
      <rect x="51" y="11" width="5" height="1" fill="#707070" class="colorizable-hair"/>
      <rect x="53" y="12" width="3" height="1" fill="#707070" class="colorizable-hair"/>
      <!-- Sombra -->
      <rect x="54" y="13" width="2" height="2" fill="#606060" class="colorizable-hair" opacity="0.5"/>

      <!-- HAT_BACK (8x8) at (56,8) - Parte trasera -->
      <rect x="56" y="8" width="8" height="3" fill="#808080" class="colorizable-hair"/>
      <rect x="57" y="11" width="6" height="1" fill="#707070" class="colorizable-hair"/>
    </svg>
  `;
}

/**
 * Generates full hair sprite - Type 2: Stylized long side hair
 * Includes all faces of the hair layer (HAT layer)
 */
export function generateHairFront_02(): string {
  return `
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
      <!-- HAT_TOP (8x8) at (40,0) - Vista superior con volumen -->
      <rect x="40" y="0" width="8" height="8" fill="#808080" class="colorizable-hair"/>
      <rect x="41" y="0" width="6" height="1" fill="#909090" class="colorizable-hair"/>
      <!-- Línea central -->
      <rect x="43" y="1" width="2" height="6" fill="#707070" class="colorizable-hair" opacity="0.3"/>

      <!-- HAT_RIGHT (8x8) at (32,8) - Lado derecho con pelo largo estilizado -->
      <!-- Base del pelo -->
      <rect x="32" y="8" width="8" height="3" fill="#808080" class="colorizable-hair"/>
      <!-- Transición -->
      <rect x="32" y="11" width="7" height="1" fill="#808080" class="colorizable-hair"/>
      <rect x="32" y="12" width="6" height="1" fill="#707070" class="colorizable-hair"/>
      <!-- Mechón largo con puntas -->
      <rect x="33" y="13" width="4" height="1" fill="#707070" class="colorizable-hair"/>
      <rect x="33" y="14" width="2" height="1" fill="#606060" class="colorizable-hair"/>

      <!-- HAT_FRONT (8x8) at (40,8) - Frente con flequillo lateral -->
      <rect x="40" y="8" width="3" height="3" fill="#808080" class="colorizable-hair"/>
      <rect x="41" y="11" width="2" height="1" fill="#707070" class="colorizable-hair"/>
      <rect x="41" y="12" width="1" height="1" fill="#606060" class="colorizable-hair"/>

      <!-- HAT_LEFT (8x8) at (48,8) - Lado izquierdo con pelo largo estilizado -->
      <!-- Base del pelo -->
      <rect x="48" y="8" width="8" height="3" fill="#808080" class="colorizable-hair"/>
      <!-- Transición -->
      <rect x="49" y="11" width="7" height="1" fill="#808080" class="colorizable-hair"/>
      <rect x="50" y="12" width="6" height="1" fill="#707070" class="colorizable-hair"/>
      <!-- Mechón largo con puntas -->
      <rect x="51" y="13" width="4" height="1" fill="#707070" class="colorizable-hair"/>
      <rect x="53" y="14" width="2" height="1" fill="#606060" class="colorizable-hair"/>

      <!-- HAT_BACK (8x8) at (56,8) - Parte trasera con detalle -->
      <rect x="56" y="8" width="8" height="4" fill="#808080" class="colorizable-hair"/>
      <rect x="57" y="12" width="6" height="1" fill="#707070" class="colorizable-hair"/>
      <rect x="58" y="13" width="4" height="1" fill="#606060" class="colorizable-hair" opacity="0.5"/>
    </svg>
  `;
}

/**
 * Generates hair sprite - Type 3: High ponytail (top view)
 * NOTE: This is kept only for HAT_TOP, it combines with others
 */
export function generateHairTop_01(): string {
  return `
    <svg width="8" height="8" xmlns="http://www.w3.org/2000/svg">
      <!-- Base de la coleta en la parte superior -->
      <rect x="3" y="0" width="2" height="2" fill="#808080" class="colorizable-hair"/>
      <rect x="2" y="1" width="4" height="1" fill="#707070" class="colorizable-hair"/>
      <!-- Volumen -->
      <rect x="1" y="0" width="6" height="1" fill="#909090" class="colorizable-hair"/>
    </svg>
  `;
}

/**
 * Generates hair sprite - Type 4: Short back hair
 * NOTE: This is kept only for HAT_BACK, it combines with others
 */
export function generateHairBack_01(): string {
  return `
    <svg width="8" height="8" xmlns="http://www.w3.org/2000/svg">
      <!-- Cubriendo parte trasera de la cabeza -->
      <rect x="0" y="0" width="8" height="3" fill="#808080" class="colorizable-hair"/>
      <rect x="1" y="3" width="6" height="1" fill="#707070" class="colorizable-hair"/>
    </svg>
  `;
}

// ============================================================================
// PEINADOS CORTOS - SISTEMA COMPLETO
// ============================================================================

/**
 * Generates short hair sprite - Type 1: Pixie Cut
 * Style: Short in back and sides, slightly longer on top with very short bangs
 * Gender: Female
 * Inspiration: Audrey Hepburn, Michelle Williams, Charlize Theron
 */
export function generateHairShort_01_Pixie(): string {
  return `
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
      <!-- HAT_TOP (8x8) at (40,0) - Vista superior con volumen en corona -->
      <rect x="40" y="0" width="8" height="8" fill="#808080" class="colorizable-hair"/>
      <rect x="41" y="0" width="6" height="1" fill="#909090" class="colorizable-hair"/>
      <rect x="42" y="1" width="4" height="1" fill="#909090" class="colorizable-hair"/>
      <!-- Centro más oscuro para profundidad -->
      <rect x="43" y="2" width="2" height="4" fill="#707070" class="colorizable-hair"/>
      <rect x="44" y="3" width="1" height="2" fill="#606060" class="colorizable-hair"/>

      <!-- HAT_BOTTOM (8x8) at (48,0) - Vista inferior (vacío para pixie) -->

      <!-- HAT_RIGHT (8x8) at (32,8) - Lado derecho muy corto -->
      <!-- Cobertura superior corta -->
      <rect x="32" y="8" width="8" height="2" fill="#808080" class="colorizable-hair"/>
      <rect x="33" y="10" width="6" height="1" fill="#707070" class="colorizable-hair"/>
      <!-- Transición sutil hacia abajo -->
      <rect x="33" y="11" width="4" height="1" fill="#707070" class="colorizable-hair"/>
      <rect x="34" y="12" width="2" height="1" fill="#606060" class="colorizable-hair"/>

      <!-- HAT_FRONT (8x8) at (40,8) - Frente con flequillo corto estilizado -->
      <rect x="40" y="8" width="8" height="2" fill="#808080" class="colorizable-hair"/>
      <!-- Flequillo texturizado -->
      <rect x="41" y="10" width="2" height="1" fill="#707070" class="colorizable-hair"/>
      <rect x="43" y="10" width="1" height="1" fill="#909090" class="colorizable-hair"/>
      <rect x="45" y="10" width="2" height="1" fill="#707070" class="colorizable-hair"/>
      <!-- Puntas del flequillo -->
      <rect x="41" y="11" width="1" height="1" fill="#606060" class="colorizable-hair"/>
      <rect x="43" y="11" width="1" height="1" fill="#606060" class="colorizable-hair"/>
      <rect x="46" y="11" width="1" height="1" fill="#606060" class="colorizable-hair"/>

      <!-- HAT_LEFT (8x8) at (48,8) - Lado izquierdo muy corto -->
      <!-- Cobertura superior corta -->
      <rect x="48" y="8" width="8" height="2" fill="#808080" class="colorizable-hair"/>
      <rect x="49" y="10" width="6" height="1" fill="#707070" class="colorizable-hair"/>
      <!-- Transición sutil hacia abajo -->
      <rect x="51" y="11" width="4" height="1" fill="#707070" class="colorizable-hair"/>
      <rect x="52" y="12" width="2" height="1" fill="#606060" class="colorizable-hair"/>

      <!-- HAT_BACK (8x8) at (56,8) - Parte trasera muy corta -->
      <rect x="56" y="8" width="8" height="2" fill="#808080" class="colorizable-hair"/>
      <rect x="57" y="10" width="6" height="1" fill="#707070" class="colorizable-hair"/>
      <rect x="58" y="11" width="4" height="1" fill="#606060" class="colorizable-hair"/>
    </svg>
  `;
}

/**
 * Generates short hair sprite - Type 2: Bob Cut
 * Style: Classic bob cut at jaw level with a straight line
 * Gender: Female/Unisex
 * Inspiration: Professional bob, Anna Wintour, corporate looks
 */
export function generateHairShort_02_BobCut(): string {
  return `
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
      <!-- HAT_TOP (8x8) at (40,0) - Vista superior -->
      <rect x="40" y="0" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="41" y="0" width="1" height="1" fill="#211712" class="colorizable-skin"/>
      <rect x="43" y="0" width="1" height="1" fill="#211712" class="colorizable-skin"/>
      <rect x="47" y="0" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="40" y="1" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="42" y="1" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="43" y="1" width="1" height="1" fill="#1c130f" class="colorizable-skin"/>
      <rect x="44" y="1" width="1" height="1" fill="#1c130f" class="colorizable-skin"/>
      <rect x="45" y="1" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="46" y="1" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="47" y="1" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="42" y="2" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="43" y="2" width="1" height="1" fill="#1c130f" class="colorizable-skin"/>
      <rect x="44" y="2" width="1" height="1" fill="#1c130f" class="colorizable-skin"/>
      <rect x="46" y="2" width="1" height="1" fill="#211712" class="colorizable-skin"/>
      <rect x="47" y="2" width="1" height="1" fill="#211712" class="colorizable-skin"/>
      <rect x="40" y="3" width="1" height="1" fill="#211712" class="colorizable-skin"/>
      <rect x="42" y="3" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="43" y="3" width="1" height="1" fill="#1c130f" class="colorizable-skin"/>
      <rect x="44" y="3" width="1" height="1" fill="#1c130f" class="colorizable-skin"/>
      <rect x="45" y="3" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="43" y="4" width="1" height="1" fill="#1c130f" class="colorizable-skin"/>
      <rect x="44" y="4" width="1" height="1" fill="#1c130f" class="colorizable-skin"/>
      <rect x="45" y="4" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="47" y="4" width="1" height="1" fill="#211712" class="colorizable-skin"/>
      <rect x="40" y="5" width="1" height="1" fill="#211712" class="colorizable-skin"/>
      <rect x="42" y="5" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="43" y="5" width="1" height="1" fill="#1c130f" class="colorizable-skin"/>
      <rect x="44" y="5" width="1" height="1" fill="#1c130f" class="colorizable-skin"/>
      <rect x="45" y="5" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="47" y="5" width="1" height="1" fill="#211712" class="colorizable-skin"/>
      <rect x="40" y="6" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="41" y="6" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="42" y="6" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="43" y="6" width="1" height="1" fill="#1c130f" class="colorizable-skin"/>
      <rect x="44" y="6" width="1" height="1" fill="#1c130f" class="colorizable-skin"/>
      <rect x="45" y="6" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="46" y="6" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="47" y="6" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="40" y="7" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="41" y="7" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="42" y="7" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="43" y="7" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="44" y="7" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="45" y="7" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="46" y="7" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="47" y="7" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>

      <!-- HAT_BOTTOM (8x8) at (48,0) - Vista inferior -->


      <!-- HAT_RIGHT (8x8) at (32,8) - Lado derecho -->
      <rect x="32" y="8" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="36" y="8" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="37" y="8" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="39" y="8" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="33" y="9" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="35" y="9" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="36" y="9" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="37" y="9" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="39" y="9" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="33" y="10" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="34" y="10" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="39" y="10" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="32" y="11" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="34" y="11" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="36" y="11" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="37" y="11" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="39" y="11" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="32" y="12" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="33" y="12" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="34" y="12" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="35" y="12" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="36" y="12" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="37" y="12" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="32" y="13" width="1" height="1" fill="#1a120e" class="colorizable-skin"/>
      <rect x="33" y="13" width="1" height="1" fill="#1a120e" class="colorizable-skin"/>
      <rect x="34" y="13" width="1" height="1" fill="#1a120e" class="colorizable-skin"/>
      <rect x="35" y="13" width="1" height="1" fill="#1a120e" class="colorizable-skin"/>
      <rect x="36" y="13" width="1" height="1" fill="#1a120e" class="colorizable-skin"/>
      <rect x="37" y="13" width="1" height="1" fill="#1a120e" class="colorizable-skin"/>
      <rect x="38" y="13" width="1" height="1" fill="#1a120e" class="colorizable-skin"/>
      <rect x="39" y="13" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="32" y="14" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="33" y="14" width="1" height="1" fill="#160f0c" class="colorizable-skin"/>
      <rect x="34" y="14" width="1" height="1" fill="#160f0c" class="colorizable-skin"/>
      <rect x="35" y="14" width="1" height="1" fill="#160f0c" class="colorizable-skin"/>
      <rect x="36" y="14" width="1" height="1" fill="#160f0c" class="colorizable-skin"/>
      <rect x="37" y="14" width="1" height="1" fill="#160f0c" class="colorizable-skin"/>
      <rect x="38" y="14" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="33" y="15" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="34" y="15" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="35" y="15" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="36" y="15" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="38" y="15" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="39" y="15" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>

      <!-- HAT_FRONT (8x8) at (40,8) - Frente -->
      <rect x="40" y="8" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="41" y="8" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="42" y="8" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="43" y="8" width="1" height="1" fill="#463126" class="colorizable-skin"/>
      <rect x="44" y="8" width="1" height="1" fill="#4e362a" class="colorizable-skin"/>
      <rect x="45" y="8" width="1" height="1" fill="#4e362a" class="colorizable-skin"/>
      <rect x="46" y="8" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="47" y="8" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="40" y="9" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="41" y="9" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="42" y="9" width="1" height="1" fill="#463126" class="colorizable-skin"/>
      <rect x="43" y="9" width="1" height="1" fill="#4e362a" class="colorizable-skin"/>
      <rect x="44" y="9" width="1" height="1" fill="#4e362a" class="colorizable-skin"/>
      <rect x="45" y="9" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="46" y="9" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="47" y="9" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="40" y="10" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="41" y="10" width="1" height="1" fill="#463126" class="colorizable-skin"/>
      <rect x="42" y="10" width="1" height="1" fill="#4e362a" class="colorizable-skin"/>
      <rect x="43" y="10" width="1" height="1" fill="#4e362a" class="colorizable-skin"/>
      <rect x="44" y="10" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="45" y="10" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="46" y="10" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="47" y="10" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="40" y="11" width="1" height="1" fill="#463126" class="colorizable-skin"/>
      <rect x="41" y="11" width="1" height="1" fill="#4e362a" class="colorizable-skin"/>
      <rect x="42" y="11" width="1" height="1" fill="#4e362a" class="colorizable-skin"/>
      <rect x="43" y="11" width="1" height="1" fill="#1a120e" class="colorizable-skin"/>
      <rect x="44" y="11" width="1" height="1" fill="#1a120e" class="colorizable-skin"/>
      <rect x="45" y="11" width="1" height="1" fill="#1a120e" class="colorizable-skin"/>
      <rect x="46" y="11" width="1" height="1" fill="#1a120e" class="colorizable-skin"/>
      <rect x="47" y="11" width="1" height="1" fill="#1a120e" class="colorizable-skin"/>
      <rect x="40" y="12" width="1" height="1" fill="#4e362a" class="colorizable-skin"/>
      <rect x="41" y="12" width="1" height="1" fill="#4e362a" class="colorizable-skin"/>
      <rect x="42" y="12" width="1" height="1" fill="#1a120e" class="colorizable-skin"/>
      <rect x="43" y="12" width="1" height="1" fill="#1a120e" class="colorizable-skin"/>
      <rect x="47" y="12" width="1" height="1" fill="#1a120e" class="colorizable-skin"/>
      <rect x="40" y="13" width="1" height="1" fill="#1a120e" class="colorizable-skin"/>
      <rect x="41" y="13" width="1" height="1" fill="#160f0c" class="colorizable-skin"/>
      <rect x="42" y="13" width="1" height="1" fill="#160f0c" class="colorizable-skin"/>
      <rect x="40" y="14" width="1" height="1" fill="#1a120e" class="colorizable-skin"/>
      <rect x="41" y="14" width="1" height="1" fill="#1a120e" class="colorizable-skin"/>
      <rect x="40" y="15" width="1" height="1" fill="#1a120e" class="colorizable-skin"/>

      <!-- HAT_LEFT (8x8) at (48,8) - Lado izquierdo -->
      <rect x="48" y="8" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="49" y="8" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="51" y="8" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="52" y="8" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="53" y="8" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="54" y="8" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="55" y="8" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="50" y="9" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="53" y="9" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="55" y="9" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="48" y="10" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="49" y="11" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="50" y="11" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="51" y="11" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="52" y="11" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="53" y="11" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="48" y="12" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="49" y="12" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="50" y="12" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="51" y="12" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="52" y="12" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="53" y="12" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="54" y="12" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="55" y="12" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="48" y="13" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="49" y="13" width="1" height="1" fill="#1a120e" class="colorizable-skin"/>
      <rect x="50" y="13" width="1" height="1" fill="#1a120e" class="colorizable-skin"/>
      <rect x="51" y="13" width="1" height="1" fill="#1a120e" class="colorizable-skin"/>
      <rect x="52" y="13" width="1" height="1" fill="#1a120e" class="colorizable-skin"/>
      <rect x="53" y="13" width="1" height="1" fill="#1a120e" class="colorizable-skin"/>
      <rect x="54" y="13" width="1" height="1" fill="#1a120e" class="colorizable-skin"/>
      <rect x="55" y="13" width="1" height="1" fill="#1a120e" class="colorizable-skin"/>
      <rect x="49" y="14" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="50" y="14" width="1" height="1" fill="#160f0c" class="colorizable-skin"/>
      <rect x="51" y="14" width="1" height="1" fill="#160f0c" class="colorizable-skin"/>
      <rect x="52" y="14" width="1" height="1" fill="#160f0c" class="colorizable-skin"/>
      <rect x="53" y="14" width="1" height="1" fill="#160f0c" class="colorizable-skin"/>
      <rect x="54" y="14" width="1" height="1" fill="#160f0c" class="colorizable-skin"/>
      <rect x="49" y="15" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="50" y="15" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="51" y="15" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="52" y="15" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="53" y="15" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="54" y="15" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>

      <!-- HAT_BACK (8x8) at (56,8) - Parte trasera -->
      <rect x="56" y="8" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="57" y="8" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="58" y="8" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="61" y="8" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="57" y="9" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="59" y="9" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="62" y="9" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="58" y="10" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="59" y="10" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="61" y="10" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="63" y="10" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="57" y="11" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="58" y="11" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="59" y="11" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="60" y="11" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="61" y="11" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="62" y="11" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="63" y="11" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="57" y="12" width="1" height="1" fill="#1a120e" class="colorizable-skin"/>
      <rect x="58" y="12" width="1" height="1" fill="#1a120e" class="colorizable-skin"/>
      <rect x="59" y="12" width="1" height="1" fill="#1a120e" class="colorizable-skin"/>
      <rect x="60" y="12" width="1" height="1" fill="#1a120e" class="colorizable-skin"/>
      <rect x="61" y="12" width="1" height="1" fill="#1a120e" class="colorizable-skin"/>
      <rect x="62" y="12" width="1" height="1" fill="#1a120e" class="colorizable-skin"/>
      <rect x="63" y="12" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="56" y="13" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="57" y="13" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="58" y="13" width="1" height="1" fill="#160f0c" class="colorizable-skin"/>
      <rect x="59" y="13" width="1" height="1" fill="#160f0c" class="colorizable-skin"/>
      <rect x="60" y="13" width="1" height="1" fill="#160f0c" class="colorizable-skin"/>
      <rect x="61" y="13" width="1" height="1" fill="#160f0c" class="colorizable-skin"/>
      <rect x="62" y="13" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="59" y="14" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="60" y="14" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="62" y="14" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="56" y="15" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="57" y="15" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="58" y="15" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="59" y="15" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="60" y="15" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="61" y="15" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="62" y="15" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
      <rect x="63" y="15" width="1" height="1" fill="#1e1410" class="colorizable-skin"/>
    </svg>
  `;
}


/**
 * Generates short hair sprite - Type 3: Buzz Cut
 * Style: Very short, uniform, clipper-cut, military style (shaved)
 * Gender: Male
 * Inspiration: Military, athletes, Jason Statham
 * 
 * NOTE: The hair is painted directly on HEAD_TOP with dark colors
 * to simulate very short hair attached to the skull. HAT layer is 100% EMPTY.
 */
export function generateHairShort_03_BuzzCut(): string {
  return `
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
      <!-- HAT COMPLETAMENTE VACÍO - El pelo rapado está pintado directamente en HEAD -->
      <!-- No se necesita HAT layer porque el corte es tan corto que no sobresale -->
    </svg>
  `;
}

// ============================================================================
// BIBLIOTECA DE SPRITES - CUERPO BASE
// ============================================================================

/**
 * Generates torso sprite - Type 1: Slim build (narrow)
 * Includes all faces of the 3D model
 */
export function generateTorso_Slim_01(): string {
  return `
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
      <!-- BODY TOP (8x4) at (20,16) -->
      <rect x="20" y="16" width="8" height="4" fill="#707070" class="colorizable-skin"/>

      <!-- BODY BOTTOM (8x4) at (28,16) -->
      <rect x="28" y="16" width="8" height="4" fill="#606060" class="colorizable-skin"/>

      <!-- BODY RIGHT (4x12) at (16,20) -->
      <rect x="16" y="20" width="4" height="12" fill="#707070" class="colorizable-skin"/>

      <!-- BODY FRONT (8x12) at (20,20) -->
      <rect x="20" y="20" width="8" height="12" fill="#808080" class="colorizable-skin"/>
      <!-- Cintura estrecha -->
      <rect x="21" y="26" width="6" height="2" fill="#707070" class="colorizable-skin"/>

      <!-- BODY LEFT (4x12) at (28,20) -->
      <rect x="28" y="20" width="4" height="12" fill="#707070" class="colorizable-skin"/>

      <!-- BODY BACK (8x12) at (32,20) -->
      <rect x="32" y="20" width="8" height="12" fill="#606060" class="colorizable-skin"/>
    </svg>
  `;
}

/** Generates torso sprite - Type 2: Athletic build (athletic) */
export function generateTorso_Athletic_01(): string {
  return `
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
      <!-- BODY TOP (8x4) at (20,16) -->
      <rect x="20" y="16" width="8" height="4" fill="#707070" class="colorizable-skin"/>

      <!-- BODY BOTTOM (8x4) at (28,16) -->
      <rect x="28" y="16" width="8" height="4" fill="#606060" class="colorizable-skin"/>

      <!-- BODY RIGHT (4x12) at (16,20) -->
      <rect x="16" y="20" width="4" height="12" fill="#707070" class="colorizable-skin"/>

      <!-- BODY FRONT (8x12) at (20,20) -->
      <rect x="20" y="20" width="8" height="12" fill="#808080" class="colorizable-skin"/>
      <!-- Definición muscular -->
      <rect x="22" y="22" width="2" height="8" fill="#707070" class="colorizable-skin" opacity="0.3"/>
      <rect x="24" y="22" width="2" height="8" fill="#707070" class="colorizable-skin" opacity="0.3"/>

      <!-- BODY LEFT (4x12) at (28,20) -->
      <rect x="28" y="20" width="4" height="12" fill="#707070" class="colorizable-skin"/>

      <!-- BODY BACK (8x12) at (32,20) -->
      <rect x="32" y="20" width="8" height="12" fill="#606060" class="colorizable-skin"/>
    </svg>
  `;
}

/** Generates torso sprite - Type 3: Average build (average) */
export function generateTorso_Average_01(): string {
  return `
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
      <!-- BODY TOP (8x4) at (20,16) -->
      <rect x="20" y="16" width="8" height="4" fill="#707070" class="colorizable-skin"/>

      <!-- BODY BOTTOM (8x4) at (28,16) -->
      <rect x="28" y="16" width="8" height="4" fill="#606060" class="colorizable-skin"/>

      <!-- BODY RIGHT (4x12) at (16,20) -->
      <rect x="16" y="20" width="4" height="12" fill="#707070" class="colorizable-skin"/>

      <!-- BODY FRONT (8x12) at (20,20) -->
      <rect x="20" y="20" width="8" height="12" fill="#808080" class="colorizable-skin"/>

      <!-- BODY LEFT (4x12) at (28,20) -->
      <rect x="28" y="20" width="4" height="12" fill="#707070" class="colorizable-skin"/>

      <!-- BODY BACK (8x12) at (32,20) -->
      <rect x="32" y="20" width="8" height="12" fill="#606060" class="colorizable-skin"/>
    </svg>
  `;
}

/**
 * Genera sprite de brazos - Tipo 1: Brazos slim (3px)
 */
export function generateArms_Slim_01(): string {
  return `
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
      <!-- ARM RIGHT (todas las caras del brazo derecho) -->
      <!-- ARM_R_TOP (4x4) at (44,16) -->
      <rect x="44" y="16" width="4" height="4" fill="#909090" class="colorizable-skin"/>

      <!-- ARM_R_BOTTOM (4x4) at (48,16) -->
      <rect x="48" y="16" width="4" height="4" fill="#707070" class="colorizable-skin"/>

      <!-- ARM_R_RIGHT (4x12) at (40,20) -->
      <rect x="40" y="20" width="4" height="12" fill="#808080" class="colorizable-skin"/>
      <!-- Sombra lateral -->
      <rect x="40" y="20" width="1" height="12" fill="#707070" class="colorizable-skin" opacity="0.4"/>

      <!-- ARM_R_FRONT (4x12) at (44,20) -->
      <rect x="44" y="20" width="4" height="12" fill="#909090" class="colorizable-skin"/>
      <!-- Definición antebrazo -->
      <rect x="45" y="26" width="1" height="6" fill="#808080" class="colorizable-skin" opacity="0.2"/>

      <!-- ARM_R_LEFT (4x12) at (48,20) -->
      <rect x="48" y="20" width="4" height="12" fill="#808080" class="colorizable-skin"/>
      <!-- Sombra lateral -->
      <rect x="51" y="20" width="1" height="12" fill="#707070" class="colorizable-skin" opacity="0.4"/>

      <!-- ARM_R_BACK (4x12) at (52,20) -->
      <rect x="52" y="20" width="4" height="12" fill="#707070" class="colorizable-skin"/>

      <!-- ARM LEFT (todas las caras del brazo izquierdo) -->
      <!-- ARM_L_TOP (4x4) at (36,48) -->
      <rect x="36" y="48" width="4" height="4" fill="#909090" class="colorizable-skin"/>

      <!-- ARM_L_BOTTOM (4x4) at (40,48) -->
      <rect x="40" y="48" width="4" height="4" fill="#707070" class="colorizable-skin"/>

      <!-- ARM_L_RIGHT (4x12) at (32,52) -->
      <rect x="32" y="52" width="4" height="12" fill="#808080" class="colorizable-skin"/>
      <!-- Sombra lateral -->
      <rect x="32" y="52" width="1" height="12" fill="#707070" class="colorizable-skin" opacity="0.4"/>

      <!-- ARM_L_FRONT (4x12) at (36,52) -->
      <rect x="36" y="52" width="4" height="12" fill="#909090" class="colorizable-skin"/>
      <!-- Definición antebrazo -->
      <rect x="37" y="58" width="1" height="6" fill="#808080" class="colorizable-skin" opacity="0.2"/>

      <!-- ARM_L_LEFT (4x12) at (40,52) -->
      <rect x="40" y="52" width="4" height="12" fill="#808080" class="colorizable-skin"/>
      <!-- Sombra lateral -->
      <rect x="43" y="52" width="1" height="12" fill="#707070" class="colorizable-skin" opacity="0.4"/>

      <!-- ARM_L_BACK (4x12) at (44,52) -->
      <rect x="44" y="52" width="4" height="12" fill="#707070" class="colorizable-skin"/>
    </svg>
  `;
}

/**
 * Genera sprite de brazos - Tipo 2: Brazos classic (4px)
 */
export function generateArms_Classic_01(): string {
  return `
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
      <!-- ARM RIGHT (todas las caras del brazo derecho) -->
      <!-- ARM_R_TOP (4x4) at (44,16) -->
      <rect x="44" y="16" width="4" height="4" fill="#909090" class="colorizable-skin"/>

      <!-- ARM_R_BOTTOM (4x4) at (48,16) -->
      <rect x="48" y="16" width="4" height="4" fill="#707070" class="colorizable-skin"/>

      <!-- ARM_R_RIGHT (4x12) at (40,20) -->
      <rect x="40" y="20" width="4" height="12" fill="#808080" class="colorizable-skin"/>
      <!-- Sombra lateral -->
      <rect x="40" y="20" width="1" height="12" fill="#707070" class="colorizable-skin" opacity="0.4"/>

      <!-- ARM_R_FRONT (4x12) at (44,20) -->
      <rect x="44" y="20" width="4" height="12" fill="#909090" class="colorizable-skin"/>
      <!-- Definición muscular -->
      <rect x="45" y="22" width="2" height="4" fill="#808080" class="colorizable-skin" opacity="0.2"/>

      <!-- ARM_R_LEFT (4x12) at (48,20) -->
      <rect x="48" y="20" width="4" height="12" fill="#808080" class="colorizable-skin"/>
      <!-- Sombra lateral -->
      <rect x="51" y="20" width="1" height="12" fill="#707070" class="colorizable-skin" opacity="0.4"/>

      <!-- ARM_R_BACK (4x12) at (52,20) -->
      <rect x="52" y="20" width="4" height="12" fill="#707070" class="colorizable-skin"/>

      <!-- ARM LEFT (todas las caras del brazo izquierdo) -->
      <!-- ARM_L_TOP (4x4) at (36,48) -->
      <rect x="36" y="48" width="4" height="4" fill="#909090" class="colorizable-skin"/>

      <!-- ARM_L_BOTTOM (4x4) at (40,48) -->
      <rect x="40" y="48" width="4" height="4" fill="#707070" class="colorizable-skin"/>

      <!-- ARM_L_RIGHT (4x12) at (32,52) -->
      <rect x="32" y="52" width="4" height="12" fill="#808080" class="colorizable-skin"/>
      <!-- Sombra lateral -->
      <rect x="32" y="52" width="1" height="12" fill="#707070" class="colorizable-skin" opacity="0.4"/>

      <!-- ARM_L_FRONT (4x12) at (36,52) -->
      <rect x="36" y="52" width="4" height="12" fill="#909090" class="colorizable-skin"/>
      <!-- Definición muscular -->
      <rect x="37" y="54" width="2" height="4" fill="#808080" class="colorizable-skin" opacity="0.2"/>

      <!-- ARM_L_LEFT (4x12) at (40,52) -->
      <rect x="40" y="52" width="4" height="12" fill="#808080" class="colorizable-skin"/>
      <!-- Sombra lateral -->
      <rect x="43" y="52" width="1" height="12" fill="#707070" class="colorizable-skin" opacity="0.4"/>

      <!-- ARM_L_BACK (4x12) at (44,52) -->
      <rect x="44" y="52" width="4" height="12" fill="#707070" class="colorizable-skin"/>
    </svg>
  `;
}

/**
 * Genera sprite de piernas - Tipo 1: Piernas average (promedio)
 */
export function generateLegs_Average_01(): string {
  return `
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
      <!-- LEG RIGHT (todas las caras de la pierna derecha) -->
      <!-- LEG_R_TOP (4x4) at (4,16) -->
      <rect x="4" y="16" width="4" height="4" fill="#707070" class="colorizable-skin"/>

      <!-- LEG_R_BOTTOM (4x4) at (8,16) -->
      <rect x="8" y="16" width="4" height="4" fill="#606060" class="colorizable-skin"/>

      <!-- LEG_R_RIGHT (4x12) at (0,20) -->
      <rect x="0" y="20" width="4" height="12" fill="#707070" class="colorizable-skin"/>

      <!-- LEG_R_FRONT (4x12) at (4,20) -->
      <rect x="4" y="20" width="4" height="12" fill="#808080" class="colorizable-skin"/>
      <!-- Definición de rodilla -->
      <rect x="5" y="26" width="2" height="1" fill="#707070" class="colorizable-skin" opacity="0.3"/>

      <!-- LEG_R_LEFT (4x12) at (8,20) -->
      <rect x="8" y="20" width="4" height="12" fill="#707070" class="colorizable-skin"/>

      <!-- LEG_R_BACK (4x12) at (12,20) -->
      <rect x="12" y="20" width="4" height="12" fill="#606060" class="colorizable-skin"/>

      <!-- LEG LEFT (todas las caras de la pierna izquierda) -->
      <!-- LEG_L_TOP (4x4) at (20,48) -->
      <rect x="20" y="48" width="4" height="4" fill="#707070" class="colorizable-skin"/>

      <!-- LEG_L_BOTTOM (4x4) at (24,48) -->
      <rect x="24" y="48" width="4" height="4" fill="#606060" class="colorizable-skin"/>

      <!-- LEG_L_RIGHT (4x12) at (16,52) -->
      <rect x="16" y="52" width="4" height="12" fill="#707070" class="colorizable-skin"/>

      <!-- LEG_L_FRONT (4x12) at (20,52) -->
      <rect x="20" y="52" width="4" height="12" fill="#808080" class="colorizable-skin"/>
      <!-- Definición de rodilla -->
      <rect x="21" y="58" width="2" height="1" fill="#707070" class="colorizable-skin" opacity="0.3"/>

      <!-- LEG_L_LEFT (4x12) at (24,52) -->
      <rect x="24" y="52" width="4" height="12" fill="#707070" class="colorizable-skin"/>

      <!-- LEG_L_BACK (4x12) at (28,52) -->
      <rect x="28" y="52" width="4" height="12" fill="#606060" class="colorizable-skin"/>
    </svg>
  `;
}

/**
 * Genera sprite de piernas - Tipo 2: Piernas long (largas)
 */
export function generateLegs_Long_01(): string {
  return `
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
      <!-- LEG RIGHT (todas las caras de la pierna derecha) -->
      <!-- LEG_R_TOP (4x4) at (4,16) -->
      <rect x="4" y="16" width="4" height="4" fill="#707070" class="colorizable-skin"/>

      <!-- LEG_R_BOTTOM (4x4) at (8,16) -->
      <rect x="8" y="16" width="4" height="4" fill="#606060" class="colorizable-skin"/>

      <!-- LEG_R_RIGHT (4x12) at (0,20) -->
      <rect x="0" y="20" width="4" height="12" fill="#707070" class="colorizable-skin"/>

      <!-- LEG_R_FRONT (4x12) at (4,20) -->
      <rect x="4" y="20" width="4" height="12" fill="#808080" class="colorizable-skin"/>
      <!-- Definición de pantorrilla -->
      <rect x="5" y="28" width="2" height="3" fill="#707070" class="colorizable-skin" opacity="0.3"/>

      <!-- LEG_R_LEFT (4x12) at (8,20) -->
      <rect x="8" y="20" width="4" height="12" fill="#707070" class="colorizable-skin"/>

      <!-- LEG_R_BACK (4x12) at (12,20) -->
      <rect x="12" y="20" width="4" height="12" fill="#606060" class="colorizable-skin"/>

      <!-- LEG LEFT (todas las caras de la pierna izquierda) -->
      <!-- LEG_L_TOP (4x4) at (20,48) -->
      <rect x="20" y="48" width="4" height="4" fill="#707070" class="colorizable-skin"/>

      <!-- LEG_L_BOTTOM (4x4) at (24,48) -->
      <rect x="24" y="48" width="4" height="4" fill="#606060" class="colorizable-skin"/>

      <!-- LEG_L_RIGHT (4x12) at (16,52) -->
      <rect x="16" y="52" width="4" height="12" fill="#707070" class="colorizable-skin"/>

      <!-- LEG_L_FRONT (4x12) at (20,52) -->
      <rect x="20" y="52" width="4" height="12" fill="#808080" class="colorizable-skin"/>
      <!-- Definición de pantorrilla -->
      <rect x="21" y="60" width="2" height="3" fill="#707070" class="colorizable-skin" opacity="0.3"/>

      <!-- LEG_L_LEFT (4x12) at (24,52) -->
      <rect x="24" y="52" width="4" height="12" fill="#707070" class="colorizable-skin"/>

      <!-- LEG_L_BACK (4x12) at (28,52) -->
      <rect x="28" y="52" width="4" height="12" fill="#606060" class="colorizable-skin"/>
    </svg>
  `;
}

// ============================================================================
// BIBLIOTECA DE SPRITES - ROPA
// ============================================================================

/**
 * Generates shirt sprite - Type 1: Basic shirt
 * Includes all faces (front, back, sides)
 */
export function generateShirt_01(): string {
  return `
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
      <!-- BODY RIGHT (4x12) at (16,20) -->
      <rect x="16" y="20" width="4" height="12" fill="#707070" class="colorizable-clothing"/>

      <!-- BODY FRONT (8x12) at (20,20) -->
      <rect x="20" y="20" width="8" height="12" fill="#808080" class="colorizable-clothing"/>
      <!-- Cuello -->
      <rect x="23" y="20" width="2" height="1" fill="#606060" class="colorizable-clothing"/>
      <!-- Botones -->
      <rect x="23" y="22" width="2" height="1" fill="#404040"/>
      <rect x="23" y="25" width="2" height="1" fill="#404040"/>
      <rect x="23" y="28" width="2" height="1" fill="#404040"/>

      <!-- BODY LEFT (4x12) at (28,20) -->
      <rect x="28" y="20" width="4" height="12" fill="#707070" class="colorizable-clothing"/>

      <!-- BODY BACK (8x12) at (32,20) -->
      <rect x="32" y="20" width="8" height="12" fill="#606060" class="colorizable-clothing"/>

      <!-- MANGAS BRAZO DERECHO (dejan 3px para manos) -->
      <!-- ARM_R_TOP (4x4) at (44,16) -->
      <rect x="44" y="16" width="4" height="4" fill="#808080" class="colorizable-clothing"/>

      <!-- ARM_R_BOTTOM (4x4) at (48,16) -->
      <rect x="48" y="16" width="4" height="4" fill="#606060" class="colorizable-clothing"/>

      <!-- ARM_R_RIGHT (4x9) at (40,20) - Solo 9px, deja 3px para manos -->
      <rect x="40" y="20" width="4" height="9" fill="#707070" class="colorizable-clothing"/>

      <!-- ARM_R_FRONT (4x9) at (44,20) -->
      <rect x="44" y="20" width="4" height="9" fill="#808080" class="colorizable-clothing"/>

      <!-- ARM_R_LEFT (4x9) at (48,20) -->
      <rect x="48" y="20" width="4" height="9" fill="#707070" class="colorizable-clothing"/>

      <!-- ARM_R_BACK (4x9) at (52,20) -->
      <rect x="52" y="20" width="4" height="9" fill="#606060" class="colorizable-clothing"/>

      <!-- MANGAS BRAZO IZQUIERDO (dejan 3px para manos) -->
      <!-- ARM_L_TOP (4x4) at (36,48) -->
      <rect x="36" y="48" width="4" height="4" fill="#808080" class="colorizable-clothing"/>

      <!-- ARM_L_BOTTOM (4x4) at (40,48) -->
      <rect x="40" y="48" width="4" height="4" fill="#606060" class="colorizable-clothing"/>

      <!-- ARM_L_RIGHT (4x9) at (32,52) - Solo 9px, deja 3px para manos -->
      <rect x="32" y="52" width="4" height="9" fill="#707070" class="colorizable-clothing"/>

      <!-- ARM_L_FRONT (4x9) at (36,52) -->
      <rect x="36" y="52" width="4" height="9" fill="#808080" class="colorizable-clothing"/>

      <!-- ARM_L_LEFT (4x9) at (40,52) -->
      <rect x="40" y="52" width="4" height="9" fill="#707070" class="colorizable-clothing"/>

      <!-- ARM_L_BACK (4x9) at (44,52) -->
      <rect x="44" y="52" width="4" height="9" fill="#606060" class="colorizable-clothing"/>
    </svg>
  `;
}

/**
 * Generates pants sprite - Type 1: Basic pants
 * Includes all faces (front, back, sides)
 */
export function generatePants_01(): string {
  return `
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
      <!-- LEG RIGHT (dejan 2px para pies) -->
      <!-- LEG_R_RIGHT (4x10) at (0,20) - Solo 10px, deja 2px para pies -->
      <rect x="0" y="20" width="4" height="10" fill="#505050" class="colorizable-clothing"/>

      <!-- LEG_R_FRONT (4x10) at (4,20) -->
      <rect x="4" y="20" width="4" height="10" fill="#606060" class="colorizable-clothing"/>
      <!-- Costura -->
      <rect x="5" y="20" width="2" height="10" fill="#505050" class="colorizable-clothing" opacity="0.7"/>

      <!-- LEG_R_LEFT (4x10) at (8,20) -->
      <rect x="8" y="20" width="4" height="10" fill="#505050" class="colorizable-clothing"/>

      <!-- LEG_R_BACK (4x10) at (12,20) -->
      <rect x="12" y="20" width="4" height="10" fill="#404040" class="colorizable-clothing"/>

      <!-- LEG LEFT (dejan 2px para pies) -->
      <!-- LEG_L_RIGHT (4x10) at (16,52) - Solo 10px, deja 2px para pies -->
      <rect x="16" y="52" width="4" height="10" fill="#505050" class="colorizable-clothing"/>

      <!-- LEG_L_FRONT (4x10) at (20,52) -->
      <rect x="20" y="52" width="4" height="10" fill="#606060" class="colorizable-clothing"/>
      <!-- Costura -->
      <rect x="21" y="52" width="2" height="10" fill="#505050" class="colorizable-clothing" opacity="0.7"/>

      <!-- LEG_L_LEFT (4x10) at (24,52) -->
      <rect x="24" y="52" width="4" height="10" fill="#505050" class="colorizable-clothing"/>

      <!-- LEG_L_BACK (4x10) at (28,52) -->
      <rect x="28" y="52" width="4" height="10" fill="#404040" class="colorizable-clothing"/>
    </svg>
  `;
}

/**
 * Generates jacket sprite - Type 1: Open jacket
 * Includes all faces (front, back, sides)
 */
export function generateJacket_01(): string {
  return `
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
      <!-- BODY FRONT (8x12) at (20,20) -->
      <!-- Solapa izquierda -->
      <rect x="20" y="20" width="3" height="12" fill="#707070" class="colorizable-clothing"/>
      <!-- Solapa derecha -->
      <rect x="25" y="20" width="3" height="12" fill="#707070" class="colorizable-clothing"/>
      <!-- Cuello -->
      <rect x="21" y="20" width="6" height="1" fill="#606060" class="colorizable-clothing"/>
      <!-- Botones/cremallera -->
      <rect x="23" y="21" width="2" height="1" fill="#303030"/>
      <rect x="23" y="23" width="2" height="1" fill="#303030"/>
      <rect x="23" y="25" width="2" height="1" fill="#303030"/>
      <!-- Bolsillos -->
      <rect x="21" y="27" width="2" height="2" fill="#505050" opacity="0.7"/>
      <rect x="25" y="27" width="2" height="2" fill="#505050" opacity="0.7"/>

      <!-- BODY BACK (8x12) at (32,20) -->
      <rect x="32" y="20" width="8" height="12" fill="#606060" class="colorizable-clothing"/>

      <!-- MANGAS BRAZO DERECHO (dejan 3px para manos) -->
      <!-- ARM_R_TOP (4x4) at (44,16) -->
      <rect x="44" y="16" width="4" height="4" fill="#707070" class="colorizable-clothing"/>

      <!-- ARM_R_BOTTOM (4x4) at (48,16) -->
      <rect x="48" y="16" width="4" height="4" fill="#505050" class="colorizable-clothing"/>

      <!-- ARM_R_RIGHT (4x9) at (40,20) - Solo 9px, deja 3px para manos -->
      <rect x="40" y="20" width="4" height="9" fill="#606060" class="colorizable-clothing"/>

      <!-- ARM_R_FRONT (4x9) at (44,20) -->
      <rect x="44" y="20" width="4" height="9" fill="#707070" class="colorizable-clothing"/>

      <!-- ARM_R_LEFT (4x9) at (48,20) -->
      <rect x="48" y="20" width="4" height="9" fill="#606060" class="colorizable-clothing"/>

      <!-- ARM_R_BACK (4x9) at (52,20) -->
      <rect x="52" y="20" width="4" height="9" fill="#505050" class="colorizable-clothing"/>

      <!-- MANGAS BRAZO IZQUIERDO (dejan 3px para manos) -->
      <!-- ARM_L_TOP (4x4) at (36,48) -->
      <rect x="36" y="48" width="4" height="4" fill="#707070" class="colorizable-clothing"/>

      <!-- ARM_L_BOTTOM (4x4) at (40,48) -->
      <rect x="40" y="48" width="4" height="4" fill="#505050" class="colorizable-clothing"/>

      <!-- ARM_L_RIGHT (4x9) at (32,52) - Solo 9px, deja 3px para manos -->
      <rect x="32" y="52" width="4" height="9" fill="#606060" class="colorizable-clothing"/>

      <!-- ARM_L_FRONT (4x9) at (36,52) -->
      <rect x="36" y="52" width="4" height="9" fill="#707070" class="colorizable-clothing"/>

      <!-- ARM_L_LEFT (4x9) at (40,52) -->
      <rect x="40" y="52" width="4" height="9" fill="#606060" class="colorizable-clothing"/>

      <!-- ARM_L_BACK (4x9) at (44,52) -->
      <rect x="44" y="52" width="4" height="9" fill="#505050" class="colorizable-clothing"/>
    </svg>
  `;
}

/**
 * Generates T-shirt sprite - Type 1: Basic short sleeve
 * Covers torso and arms only up to the elbow (~6px)
 */
export function generateTShirt_01(): string {
  return `
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
      <!-- BODY RIGHT (4x12) at (16,20) -->
      <rect x="16" y="20" width="4" height="12" fill="#707070" class="colorizable-clothing"/>

      <!-- BODY FRONT (8x12) at (20,20) -->
      <rect x="20" y="20" width="8" height="12" fill="#808080" class="colorizable-clothing"/>
      <!-- Cuello redondo -->
      <rect x="22" y="20" width="4" height="1" fill="#606060" class="colorizable-clothing"/>

      <!-- BODY LEFT (4x12) at (28,20) -->
      <rect x="28" y="20" width="4" height="12" fill="#707070" class="colorizable-clothing"/>

      <!-- BODY BACK (8x12) at (32,20) -->
      <rect x="32" y="20" width="8" height="12" fill="#606060" class="colorizable-clothing"/>

      <!-- MANGAS CORTAS BRAZO DERECHO (solo 6px desde hombro) -->
      <!-- ARM_R_TOP (4x4) at (44,16) -->
      <rect x="44" y="16" width="4" height="4" fill="#808080" class="colorizable-clothing"/>

      <!-- ARM_R_BOTTOM (4x4) at (48,16) -->
      <rect x="48" y="16" width="4" height="4" fill="#606060" class="colorizable-clothing"/>

      <!-- ARM_R_RIGHT (4x6) at (40,20) - Solo 6px, manga corta -->
      <rect x="40" y="20" width="4" height="6" fill="#707070" class="colorizable-clothing"/>

      <!-- ARM_R_FRONT (4x6) at (44,20) -->
      <rect x="44" y="20" width="4" height="6" fill="#808080" class="colorizable-clothing"/>
      <!-- Dobladillo de manga -->
      <rect x="44" y="25" width="4" height="1" fill="#606060" class="colorizable-clothing"/>

      <!-- ARM_R_LEFT (4x6) at (48,20) -->
      <rect x="48" y="20" width="4" height="6" fill="#707070" class="colorizable-clothing"/>

      <!-- ARM_R_BACK (4x6) at (52,20) -->
      <rect x="52" y="20" width="4" height="6" fill="#606060" class="colorizable-clothing"/>

      <!-- MANGAS CORTAS BRAZO IZQUIERDO (solo 6px desde hombro) -->
      <!-- ARM_L_TOP (4x4) at (36,48) -->
      <rect x="36" y="48" width="4" height="4" fill="#808080" class="colorizable-clothing"/>

      <!-- ARM_L_BOTTOM (4x4) at (40,48) -->
      <rect x="40" y="48" width="4" height="4" fill="#606060" class="colorizable-clothing"/>

      <!-- ARM_L_RIGHT (4x6) at (32,52) - Solo 6px, manga corta -->
      <rect x="32" y="52" width="4" height="6" fill="#707070" class="colorizable-clothing"/>

      <!-- ARM_L_FRONT (4x6) at (36,52) -->
      <rect x="36" y="52" width="4" height="6" fill="#808080" class="colorizable-clothing"/>
      <!-- Dobladillo de manga -->
      <rect x="36" y="57" width="4" height="1" fill="#606060" class="colorizable-clothing"/>

      <!-- ARM_L_LEFT (4x6) at (40,52) -->
      <rect x="40" y="52" width="4" height="6" fill="#707070" class="colorizable-clothing"/>

      <!-- ARM_L_BACK (4x6) at (44,52) -->
      <rect x="44" y="52" width="4" height="6" fill="#606060" class="colorizable-clothing"/>
    </svg>
  `;
}

/**
 * Generates T-shirt sprite - Type 2: Sports T-shirt
 * With stripes on the shoulders
 */
export function generateTShirt_02(): string {
  return `
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
      <!-- BODY RIGHT (4x12) at (16,20) -->
      <rect x="16" y="20" width="4" height="12" fill="#707070" class="colorizable-clothing"/>

      <!-- BODY FRONT (8x12) at (20,20) -->
      <rect x="20" y="20" width="8" height="12" fill="#808080" class="colorizable-clothing"/>
      <!-- Cuello en V -->
      <rect x="23" y="20" width="1" height="2" fill="#606060" class="colorizable-clothing"/>
      <rect x="24" y="20" width="1" height="2" fill="#606060" class="colorizable-clothing"/>

      <!-- BODY LEFT (4x12) at (28,20) -->
      <rect x="28" y="20" width="4" height="12" fill="#707070" class="colorizable-clothing"/>

      <!-- BODY BACK (8x12) at (32,20) -->
      <rect x="32" y="20" width="8" height="12" fill="#606060" class="colorizable-clothing"/>

      <!-- MANGAS CORTAS CON FRANJAS -->
      <!-- ARM_R_TOP (4x4) at (44,16) -->
      <rect x="44" y="16" width="4" height="4" fill="#808080" class="colorizable-clothing"/>

      <!-- ARM_R_BOTTOM (4x4) at (48,16) -->
      <rect x="48" y="16" width="4" height="4" fill="#606060" class="colorizable-clothing"/>

      <!-- ARM_R_RIGHT (4x6) at (40,20) -->
      <rect x="40" y="20" width="4" height="6" fill="#707070" class="colorizable-clothing"/>
      <!-- Franja horizontal -->
      <rect x="40" y="21" width="4" height="1" fill="#505050" class="colorizable-clothing"/>

      <!-- ARM_R_FRONT (4x6) at (44,20) -->
      <rect x="44" y="20" width="4" height="6" fill="#808080" class="colorizable-clothing"/>
      <rect x="44" y="21" width="4" height="1" fill="#606060" class="colorizable-clothing"/>

      <!-- ARM_R_LEFT (4x6) at (48,20) -->
      <rect x="48" y="20" width="4" height="6" fill="#707070" class="colorizable-clothing"/>
      <rect x="48" y="21" width="4" height="1" fill="#505050" class="colorizable-clothing"/>

      <!-- ARM_R_BACK (4x6) at (52,20) -->
      <rect x="52" y="20" width="4" height="6" fill="#606060" class="colorizable-clothing"/>

      <!-- ARM_L_TOP (4x4) at (36,48) -->
      <rect x="36" y="48" width="4" height="4" fill="#808080" class="colorizable-clothing"/>

      <!-- ARM_L_BOTTOM (4x4) at (40,48) -->
      <rect x="40" y="48" width="4" height="4" fill="#606060" class="colorizable-clothing"/>

      <!-- ARM_L_RIGHT (4x6) at (32,52) -->
      <rect x="32" y="52" width="4" height="6" fill="#707070" class="colorizable-clothing"/>
      <rect x="32" y="53" width="4" height="1" fill="#505050" class="colorizable-clothing"/>

      <!-- ARM_L_FRONT (4x6) at (36,52) -->
      <rect x="36" y="52" width="4" height="6" fill="#808080" class="colorizable-clothing"/>
      <rect x="36" y="53" width="4" height="1" fill="#606060" class="colorizable-clothing"/>

      <!-- ARM_L_LEFT (4x6) at (40,52) -->
      <rect x="40" y="52" width="4" height="6" fill="#707070" class="colorizable-clothing"/>
      <rect x="40" y="53" width="4" height="1" fill="#505050" class="colorizable-clothing"/>

      <!-- ARM_L_BACK (4x6) at (44,52) -->
      <rect x="44" y="52" width="4" height="6" fill="#606060" class="colorizable-clothing"/>
    </svg>
  `;
}
/**
 * Generates t-shirt sprite - Type 3: T-shirt with simple face
 * Custom design with face drawn on the front
 */
export function generateTShirt_03(): string {
  return `
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">

      <!-- BODY_RIGHT (4x12) at (16,20) -->
      <rect x="16" y="20" width="4" height="12" fill="#1a1a1a" class="colorizable-clothing"/>

      <!-- BODY_FRONT (8x12) at (20,20) - Con cara simple -->
      <rect x="20" y="20" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="21" y="20" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="22" y="20" width="1" height="1" fill="#706253"/>
      <rect x="23" y="20" width="1" height="1" fill="#706253"/>
      <rect x="24" y="20" width="1" height="1" fill="#706253"/>
      <rect x="25" y="20" width="1" height="1" fill="#706253"/>
      <rect x="26" y="20" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="27" y="20" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="20" y="21" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="21" y="21" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="22" y="21" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="23" y="21" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="24" y="21" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="25" y="21" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="26" y="21" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="27" y="21" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="20" y="22" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="21" y="22" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="22" y="22" width="1" height="1" fill="#ffffff" class="colorizable-clothing"/>
      <rect x="23" y="22" width="1" height="1" fill="#ffffff" class="colorizable-clothing"/>
      <rect x="24" y="22" width="1" height="1" fill="#ffffff" class="colorizable-clothing"/>
      <rect x="25" y="22" width="1" height="1" fill="#ffffff" class="colorizable-clothing"/>
      <rect x="26" y="22" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="27" y="22" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="20" y="23" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="21" y="23" width="1" height="1" fill="#ffffff" class="colorizable-clothing"/>
      <rect x="22" y="23" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="23" y="23" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="24" y="23" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="25" y="23" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="26" y="23" width="1" height="1" fill="#ffffff" class="colorizable-clothing"/>
      <rect x="27" y="23" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="20" y="24" width="1" height="1" fill="#ffffff" class="colorizable-clothing"/>
      <rect x="21" y="24" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="22" y="24" width="1" height="1" fill="#ffffff" class="colorizable-clothing"/>
      <rect x="23" y="24" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="24" y="24" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="25" y="24" width="1" height="1" fill="#ffffff" class="colorizable-clothing"/>
      <rect x="26" y="24" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="27" y="24" width="1" height="1" fill="#ffffff" class="colorizable-clothing"/>
      <rect x="20" y="25" width="1" height="1" fill="#ffffff" class="colorizable-clothing"/>
      <rect x="21" y="25" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="22" y="25" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="23" y="25" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="24" y="25" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="25" y="25" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="26" y="25" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="27" y="25" width="1" height="1" fill="#ffffff" class="colorizable-clothing"/>
      <rect x="20" y="26" width="1" height="1" fill="#ffffff" class="colorizable-clothing"/>
      <rect x="21" y="26" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="22" y="26" width="1" height="1" fill="#ffffff" class="colorizable-clothing"/>
      <rect x="23" y="26" width="1" height="1" fill="#ffffff" class="colorizable-clothing"/>
      <rect x="24" y="26" width="1" height="1" fill="#ffffff" class="colorizable-clothing"/>
      <rect x="25" y="26" width="1" height="1" fill="#ffffff" class="colorizable-clothing"/>
      <rect x="26" y="26" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="27" y="26" width="1" height="1" fill="#ffffff" class="colorizable-clothing"/>
      <rect x="20" y="27" width="1" height="1" fill="#ffffff" class="colorizable-clothing"/>
      <rect x="21" y="27" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="22" y="27" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="23" y="27" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="24" y="27" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="25" y="27" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="26" y="27" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="27" y="27" width="1" height="1" fill="#ffffff" class="colorizable-clothing"/>
      <rect x="20" y="28" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="21" y="28" width="1" height="1" fill="#ffffff" class="colorizable-clothing"/>
      <rect x="22" y="28" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="23" y="28" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="24" y="28" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="25" y="28" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="26" y="28" width="1" height="1" fill="#ffffff" class="colorizable-clothing"/>
      <rect x="27" y="28" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="20" y="29" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="21" y="29" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="22" y="29" width="1" height="1" fill="#ffffff" class="colorizable-clothing"/>
      <rect x="23" y="29" width="1" height="1" fill="#ffffff" class="colorizable-clothing"/>
      <rect x="24" y="29" width="1" height="1" fill="#ffffff" class="colorizable-clothing"/>
      <rect x="25" y="29" width="1" height="1" fill="#ffffff" class="colorizable-clothing"/>
      <rect x="26" y="29" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="27" y="29" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="20" y="30" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="21" y="30" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="22" y="30" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="23" y="30" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="24" y="30" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="25" y="30" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="26" y="30" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="27" y="30" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="20" y="31" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="21" y="31" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="22" y="31" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="23" y="31" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="24" y="31" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="25" y="31" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="26" y="31" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="27" y="31" width="1" height="1" fill="#1a1a1a" class="colorizable-clothing"/>

      <!-- BODY_LEFT (4x12) at (28,20) -->
      <rect x="28" y="20" width="4" height="12" fill="#1a1a1a" class="colorizable-clothing"/>

      <!-- BODY_BACK (8x12) at (32,20) -->
      <rect x="32" y="20" width="8" height="12" fill="#1a1a1a" class="colorizable-clothing"/>

      <!-- ARM_R_TOP (4x4) at (44,16) -->
      <rect x="44" y="16" width="4" height="4" fill="#1a1a1a" class="colorizable-clothing"/>

      <!-- ARM_R_BOTTOM (4x4) at (48,16) - Piel visible -->
      <rect x="48" y="16" width="4" height="4" fill="#7b6c59"/>

      <!-- ARM_R_RIGHT (4x12) at (40,20) -->
      <rect x="40" y="20" width="4" height="5" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="40" y="25" width="4" height="1" fill="#aaaaaa" class="colorizable-clothing"/>
      <rect x="40" y="26" width="4" height="6" fill="#756755"/>

      <!-- ARM_R_FRONT (4x12) at (44,20) -->
      <rect x="44" y="20" width="4" height="5" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="44" y="25" width="4" height="1" fill="#aaaaaa" class="colorizable-clothing"/>
      <rect x="44" y="26" width="4" height="6" fill="#8a7964"/>

      <!-- ARM_R_LEFT (4x12) at (48,20) -->
      <rect x="48" y="20" width="4" height="5" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="48" y="25" width="4" height="1" fill="#aaaaaa" class="colorizable-clothing"/>
      <rect x="48" y="26" width="4" height="6" fill="#7b6c59"/>

      <!-- ARM_R_BACK (4x12) at (52,20) -->
      <rect x="52" y="20" width="4" height="5" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="52" y="25" width="4" height="1" fill="#aaaaaa" class="colorizable-clothing"/>
      <rect x="52" y="26" width="4" height="6" fill="#6c5e4e"/>

      <!-- ARM_L_TOP (4x4) at (36,48) -->
      <rect x="36" y="48" width="4" height="4" fill="#1a1a1a" class="colorizable-clothing"/>

      <!-- ARM_L_BOTTOM (4x4) at (40,48) - Piel visible -->
      <rect x="40" y="48" width="4" height="4" fill="#7b6c59"/>

      <!-- ARM_L_RIGHT (4x12) at (32,52) -->
      <rect x="32" y="52" width="4" height="5" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="32" y="57" width="4" height="1" fill="#aaaaaa" class="colorizable-clothing"/>
      <rect x="32" y="58" width="4" height="6" fill="#756755"/>

      <!-- ARM_L_FRONT (4x12) at (36,52) -->
      <rect x="36" y="52" width="4" height="5" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="36" y="57" width="4" height="1" fill="#aaaaaa" class="colorizable-clothing"/>
      <rect x="36" y="58" width="4" height="6" fill="#8a7964"/>

      <!-- ARM_L_LEFT (4x12) at (40,52) -->
      <rect x="40" y="52" width="4" height="5" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="40" y="57" width="4" height="1" fill="#aaaaaa" class="colorizable-clothing"/>
      <rect x="40" y="58" width="4" height="6" fill="#7b6c59"/>

      <!-- ARM_L_BACK (4x12) at (44,52) -->
      <rect x="44" y="52" width="4" height="5" fill="#1a1a1a" class="colorizable-clothing"/>
      <rect x="44" y="57" width="4" height="1" fill="#aaaaaa" class="colorizable-clothing"/>
      <rect x="44" y="58" width="4" height="6" fill="#6c5e4e"/>
    </svg>
  `;
}



// ============================================================================
// BIBLIOTECA DE SPRITES - ACCESORIOS (EXTREMIDADES)
// ============================================================================

/**
 * Generates glove sprite - Type 1: Basic gloves
 * Cover only the hands (last 3px of the arms)
 */
export function generateGloves_01(): string {
  return `
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
      <!-- GUANTE BRAZO DERECHO (solo manos, últimos 3px) -->
      <!-- ARM_R_RIGHT (4x3) at (40,29) -->
      <rect x="40" y="29" width="4" height="3" fill="#505050" class="colorizable-clothing"/>

      <!-- ARM_R_FRONT (4x3) at (44,29) -->
      <rect x="44" y="29" width="4" height="3" fill="#606060" class="colorizable-clothing"/>
      <!-- Detalle de muñeca -->
      <rect x="44" y="29" width="4" height="1" fill="#404040" class="colorizable-clothing"/>

      <!-- ARM_R_LEFT (4x3) at (48,29) -->
      <rect x="48" y="29" width="4" height="3" fill="#505050" class="colorizable-clothing"/>

      <!-- ARM_R_BACK (4x3) at (52,29) -->
      <rect x="52" y="29" width="4" height="3" fill="#404040" class="colorizable-clothing"/>

      <!-- GUANTE BRAZO IZQUIERDO (solo manos, últimos 3px) -->
      <!-- ARM_L_RIGHT (4x3) at (32,61) -->
      <rect x="32" y="61" width="4" height="3" fill="#505050" class="colorizable-clothing"/>

      <!-- ARM_L_FRONT (4x3) at (36,61) -->
      <rect x="36" y="61" width="4" height="3" fill="#606060" class="colorizable-clothing"/>
      <!-- Detalle de muñeca -->
      <rect x="36" y="61" width="4" height="1" fill="#404040" class="colorizable-clothing"/>

      <!-- ARM_L_LEFT (4x3) at (40,61) -->
      <rect x="40" y="61" width="4" height="3" fill="#505050" class="colorizable-clothing"/>

      <!-- ARM_L_BACK (4x3) at (44,61) -->
      <rect x="44" y="61" width="4" height="3" fill="#404040" class="colorizable-clothing"/>
    </svg>
  `;
}

/**
 * Genera sprite de guantes - Tipo 2: Guantes de cuero/trabajo
 */
export function generateGloves_02(): string {
  return `
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
      <!-- GUANTE BRAZO DERECHO -->
      <!-- ARM_R_RIGHT (4x3) at (40,29) -->
      <rect x="40" y="29" width="4" height="3" fill="#5C4033" class="colorizable-clothing"/>
      <!-- Costuras -->
      <rect x="41" y="29" width="1" height="3" fill="#4A3022" class="colorizable-clothing" opacity="0.5"/>

      <!-- ARM_R_FRONT (4x3) at (44,29) -->
      <rect x="44" y="29" width="4" height="3" fill="#6B4E3D" class="colorizable-clothing"/>
      <rect x="45" y="29" width="1" height="3" fill="#5C4033" class="colorizable-clothing" opacity="0.5"/>

      <!-- ARM_R_LEFT (4x3) at (48,29) -->
      <rect x="48" y="29" width="4" height="3" fill="#5C4033" class="colorizable-clothing"/>

      <!-- ARM_R_BACK (4x3) at (52,29) -->
      <rect x="52" y="29" width="4" height="3" fill="#4A3022" class="colorizable-clothing"/>

      <!-- GUANTE BRAZO IZQUIERDO -->
      <!-- ARM_L_RIGHT (4x3) at (32,61) -->
      <rect x="32" y="61" width="4" height="3" fill="#5C4033" class="colorizable-clothing"/>
      <rect x="33" y="61" width="1" height="3" fill="#4A3022" class="colorizable-clothing" opacity="0.5"/>

      <!-- ARM_L_FRONT (4x3) at (36,61) -->
      <rect x="36" y="61" width="4" height="3" fill="#6B4E3D" class="colorizable-clothing"/>
      <rect x="37" y="61" width="1" height="3" fill="#5C4033" class="colorizable-clothing" opacity="0.5"/>

      <!-- ARM_L_LEFT (4x3) at (40,61) -->
      <rect x="40" y="61" width="4" height="3" fill="#5C4033" class="colorizable-clothing"/>

      <!-- ARM_L_BACK (4x3) at (44,61) -->
      <rect x="44" y="61" width="4" height="3" fill="#4A3022" class="colorizable-clothing"/>
    </svg>
  `;
}

/**
 * Generates shoe/sneaker sprite - Type 1: Sports sneakers
 * Cover only the feet (last 2px of the legs)
 */
export function generateShoes_01(): string {
  return `
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
      <!-- ZAPATO PIERNA DERECHA (últimos 2px) -->
      <!-- LEG_R_RIGHT (4x2) at (0,30) -->
      <rect x="0" y="30" width="4" height="2" fill="#404040" class="colorizable-clothing"/>

      <!-- LEG_R_FRONT (4x2) at (4,30) -->
      <rect x="4" y="30" width="4" height="2" fill="#505050" class="colorizable-clothing"/>
      <!-- Suela -->
      <rect x="4" y="31" width="4" height="1" fill="#303030"/>
      <!-- Rayas deportivas -->
      <rect x="5" y="30" width="2" height="1" fill="#FFFFFF" opacity="0.7"/>

      <!-- LEG_R_LEFT (4x2) at (8,30) -->
      <rect x="8" y="30" width="4" height="2" fill="#404040" class="colorizable-clothing"/>

      <!-- LEG_R_BACK (4x2) at (12,30) -->
      <rect x="12" y="30" width="4" height="2" fill="#303030" class="colorizable-clothing"/>

      <!-- ZAPATO PIERNA IZQUIERDA (últimos 2px) -->
      <!-- LEG_L_RIGHT (4x2) at (16,62) -->
      <rect x="16" y="62" width="4" height="2" fill="#404040" class="colorizable-clothing"/>

      <!-- LEG_L_FRONT (4x2) at (20,62) -->
      <rect x="20" y="62" width="4" height="2" fill="#505050" class="colorizable-clothing"/>
      <!-- Suela -->
      <rect x="20" y="63" width="4" height="1" fill="#303030"/>
      <!-- Rayas deportivas -->
      <rect x="21" y="62" width="2" height="1" fill="#FFFFFF" opacity="0.7"/>

      <!-- LEG_L_LEFT (4x2) at (24,62) -->
      <rect x="24" y="62" width="4" height="2" fill="#404040" class="colorizable-clothing"/>

      <!-- LEG_L_BACK (4x2) at (28,62) -->
      <rect x="28" y="62" width="4" height="2" fill="#303030" class="colorizable-clothing"/>
    </svg>
  `;
}

/**
 * Genera sprite de zapatos - Tipo 2: Zapatos formales
 */
export function generateShoes_02(): string {
  return `
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
      <!-- ZAPATO PIERNA DERECHA -->
      <!-- LEG_R_RIGHT (4x2) at (0,30) -->
      <rect x="0" y="30" width="4" height="2" fill="#1A1A1A" class="colorizable-clothing"/>

      <!-- LEG_R_FRONT (4x2) at (4,30) -->
      <rect x="4" y="30" width="4" height="2" fill="#2A2A2A" class="colorizable-clothing"/>
      <!-- Suela -->
      <rect x="4" y="31" width="4" height="1" fill="#0A0A0A"/>
      <!-- Brillo -->
      <rect x="5" y="30" width="1" height="1" fill="#FFFFFF" opacity="0.3"/>

      <!-- LEG_R_LEFT (4x2) at (8,30) -->
      <rect x="8" y="30" width="4" height="2" fill="#1A1A1A" class="colorizable-clothing"/>

      <!-- LEG_R_BACK (4x2) at (12,30) -->
      <rect x="12" y="30" width="4" height="2" fill="#0F0F0F" class="colorizable-clothing"/>

      <!-- ZAPATO PIERNA IZQUIERDA -->
      <!-- LEG_L_RIGHT (4x2) at (16,62) -->
      <rect x="16" y="62" width="4" height="2" fill="#1A1A1A" class="colorizable-clothing"/>

      <!-- LEG_L_FRONT (4x2) at (20,62) -->
      <rect x="20" y="62" width="4" height="2" fill="#2A2A2A" class="colorizable-clothing"/>
      <!-- Suela -->
      <rect x="20" y="63" width="4" height="1" fill="#0A0A0A"/>
      <!-- Brillo -->
      <rect x="21" y="62" width="1" height="1" fill="#FFFFFF" opacity="0.3"/>

      <!-- LEG_L_LEFT (4x2) at (24,62) -->
      <rect x="24" y="62" width="4" height="2" fill="#1A1A1A" class="colorizable-clothing"/>

      <!-- LEG_L_BACK (4x2) at (28,62) -->
      <rect x="28" y="62" width="4" height="2" fill="#0F0F0F" class="colorizable-clothing"/>
    </svg>
  `;
}

/**
 * Generates boot sprite - Type 1: High boots
 * Cover more of the leg (last 4px)
 */
export function generateBoots_01(): string {
  return `
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
      <!-- BOTA PIERNA DERECHA (últimos 4px) -->
      <!-- LEG_R_RIGHT (4x4) at (0,28) -->
      <rect x="0" y="28" width="4" height="4" fill="#3D2817" class="colorizable-clothing"/>
      <!-- Hebilla -->
      <rect x="1" y="29" width="2" height="1" fill="#C0C0C0" opacity="0.8"/>

      <!-- LEG_R_FRONT (4x4) at (4,28) -->
      <rect x="4" y="28" width="4" height="4" fill="#4A3022" class="colorizable-clothing"/>
      <!-- Suela gruesa -->
      <rect x="4" y="31" width="4" height="1" fill="#1A1A1A"/>
      <!-- Costura -->
      <rect x="5" y="28" width="2" height="4" fill="#3D2817" class="colorizable-clothing" opacity="0.5"/>

      <!-- LEG_R_LEFT (4x4) at (8,28) -->
      <rect x="8" y="28" width="4" height="4" fill="#3D2817" class="colorizable-clothing"/>

      <!-- LEG_R_BACK (4x4) at (12,28) -->
      <rect x="12" y="28" width="4" height="4" fill="#2C1810" class="colorizable-clothing"/>

      <!-- BOTA PIERNA IZQUIERDA (últimos 4px) -->
      <!-- LEG_L_RIGHT (4x4) at (16,60) -->
      <rect x="16" y="60" width="4" height="4" fill="#3D2817" class="colorizable-clothing"/>
      <!-- Hebilla -->
      <rect x="17" y="61" width="2" height="1" fill="#C0C0C0" opacity="0.8"/>

      <!-- LEG_L_FRONT (4x4) at (20,60) -->
      <rect x="20" y="60" width="4" height="4" fill="#4A3022" class="colorizable-clothing"/>
      <!-- Suela gruesa -->
      <rect x="20" y="63" width="4" height="1" fill="#1A1A1A"/>
      <!-- Costura -->
      <rect x="21" y="60" width="2" height="4" fill="#3D2817" class="colorizable-clothing" opacity="0.5"/>

      <!-- LEG_L_LEFT (4x4) at (24,60) -->
      <rect x="24" y="60" width="4" height="4" fill="#3D2817" class="colorizable-clothing"/>

      <!-- LEG_L_BACK (4x4) at (28,60) -->
      <rect x="28" y="60" width="4" height="4" fill="#2C1810" class="colorizable-clothing"/>
    </svg>
  `;
}

// ============================================================================
// BIBLIOTECA DE SPRITES - ACCESORIOS (CABEZA)
// ============================================================================

/**
 * Genera sprite de lentes - Tipo 1: Lentes redondos
 */
export function generateGlasses_01(): string {
  return `
    <svg width="8" height="8" xmlns="http://www.w3.org/2000/svg">
      <!-- Marco izquierdo -->
      <rect x="1" y="3" width="2" height="2" fill="none" stroke="#303030" stroke-width="1"/>
      <!-- Marco derecho -->
      <rect x="5" y="3" width="2" height="2" fill="none" stroke="#303030" stroke-width="1"/>
      <!-- Puente -->
      <rect x="3" y="3" width="2" height="1" fill="#303030"/>
      <!-- Brillo en lentes -->
      <rect x="1" y="3" width="1" height="1" fill="#FFFFFF" opacity="0.5"/>
      <rect x="5" y="3" width="1" height="1" fill="#FFFFFF" opacity="0.5"/>
    </svg>
  `;
}

/** Generates hat sprite - Type 1: Cap with viser */
export function generateHat_01(): string {
  return `
    <svg width="8" height="8" xmlns="http://www.w3.org/2000/svg">
      <!-- Parte superior de la gorra -->
      <rect x="1" y="0" width="6" height="2" fill="#707070" class="colorizable-clothing"/>
      <!-- Visera -->
      <rect x="0" y="2" width="8" height="1" fill="#505050" class="colorizable-clothing"/>
      <!-- Sombra de visera -->
      <rect x="0" y="3" width="8" height="1" fill="#303030" opacity="0.3"/>
    </svg>
  `;
}

/**
 * Generates complete outfit with sleeves for long wavy hairstyle
 * Includes hairless torso + sleeves with dark edges
 */
export function generateOutfit_WavySleeves_01(): string {
  return `
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
      <!-- BODY (TORSO) -->
      <!-- BODY_RIGHT (4x12) at (16,20) -->
      <rect x="16" y="20" width="4" height="12" fill="#604549"/>

      <!-- BODY_FRONT (8x12) at (20,20) -->
      <rect x="20" y="20" width="8" height="12" fill="#604549"/>

      <!-- BODY_LEFT (4x12) at (28,20) -->
      <rect x="28" y="20" width="4" height="12" fill="#604549"/>

      <!-- BODY_BACK (8x12) at (32,20) - Color de la ropa (se superpone el pelo) -->
      <rect x="32" y="20" width="8" height="12" fill="#604549"/>

      <!-- BRAZO DERECHO -->
      <!-- ARM_R_TOP (4x4) at (44,16) - Hombro con mechones -->
      <rect x="44" y="16" width="1" height="1" fill="#705055"/>
      <rect x="45" y="16" width="3" height="1" fill="#783636"/>
      <rect x="44" y="17" width="1" height="1" fill="#705055"/>
      <rect x="45" y="17" width="3" height="1" fill="#783636"/>
      <rect x="44" y="18" width="2" height="1" fill="#705055"/>
      <rect x="46" y="18" width="2" height="1" fill="#783636"/>
      <rect x="44" y="19" width="2" height="1" fill="#705055"/>
      <rect x="46" y="19" width="2" height="1" fill="#783636"/>

      <!-- ARM_R_BOTTOM (4x4) at (48,16) -->
      <rect x="48" y="16" width="4" height="4" fill="#706253" class="colorizable-skin"/>

      <!-- BRAZO DERECHO -->
      <!-- ARM_R_FRONT (4x12) at (44,20) -->
      <rect x="44" y="20" width="4" height="1" fill="#705055"/>
      <rect x="44" y="21" width="4" height="1" fill="#705055"/>
      <rect x="44" y="22" width="4" height="1" fill="#705055"/>
      <rect x="44" y="23" width="4" height="1" fill="#705055"/>
      <rect x="44" y="24" width="4" height="1" fill="#705055"/>
      <rect x="44" y="25" width="4" height="1" fill="#604549"/>
      <rect x="44" y="26" width="1" height="1" fill="#907e6b" class="colorizable-skin"/>
      <rect x="45" y="26" width="1" height="1" fill="#8d7c69" class="colorizable-skin"/>
      <rect x="46" y="26" width="2" height="1" fill="#907e6b" class="colorizable-skin"/>
      <rect x="44" y="27" width="1" height="1" fill="#907e6b" class="colorizable-skin"/>
      <rect x="45" y="27" width="1" height="1" fill="#8d7c69" class="colorizable-skin"/>
      <rect x="46" y="27" width="2" height="1" fill="#907e6b" class="colorizable-skin"/>
      <rect x="44" y="28" width="1" height="1" fill="#907e6b" class="colorizable-skin"/>
      <rect x="45" y="28" width="1" height="1" fill="#8d7c69" class="colorizable-skin"/>
      <rect x="46" y="28" width="2" height="1" fill="#907e6b" class="colorizable-skin"/>
      <rect x="44" y="29" width="1" height="1" fill="#907e6b" class="colorizable-skin"/>
      <rect x="45" y="29" width="1" height="1" fill="#8d7c69" class="colorizable-skin"/>
      <rect x="46" y="29" width="2" height="1" fill="#907e6b" class="colorizable-skin"/>
      <rect x="44" y="30" width="1" height="1" fill="#907e6b" class="colorizable-skin"/>
      <rect x="45" y="30" width="1" height="1" fill="#8d7c69" class="colorizable-skin"/>
      <rect x="46" y="30" width="2" height="1" fill="#907e6b" class="colorizable-skin"/>
      <rect x="44" y="31" width="1" height="1" fill="#907e6b" class="colorizable-skin"/>
      <rect x="45" y="31" width="1" height="1" fill="#8d7c69" class="colorizable-skin"/>
      <rect x="46" y="31" width="2" height="1" fill="#907e6b" class="colorizable-skin"/>

      <!-- ARM_R_BACK (4x12) at (52,20) -->
      <rect x="52" y="20" width="2" height="1" fill="#783636"/>
      <rect x="54" y="20" width="2" height="1" fill="#604549"/>
      <rect x="52" y="21" width="1" height="1" fill="#783636"/>
      <rect x="53" y="21" width="3" height="1" fill="#604549"/>
      <rect x="52" y="22" width="4" height="1" fill="#604549"/>
      <rect x="52" y="23" width="4" height="1" fill="#604549"/>
      <rect x="52" y="24" width="4" height="1" fill="#604549"/>
      <rect x="52" y="25" width="4" height="1" fill="#553e41"/>
      <rect x="52" y="26" width="4" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="52" y="27" width="4" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="52" y="28" width="4" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="52" y="29" width="4" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="52" y="30" width="4" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="52" y="31" width="4" height="1" fill="#706253" class="colorizable-skin"/>

      <!-- ARM_R_RIGHT (4x12) at (40,20) -->
      <rect x="40" y="20" width="4" height="1" fill="#705055"/>
      <rect x="40" y="21" width="4" height="1" fill="#705055"/>
      <rect x="40" y="22" width="4" height="1" fill="#705055"/>
      <rect x="40" y="23" width="4" height="1" fill="#705055"/>
      <rect x="40" y="24" width="4" height="1" fill="#705055"/>
      <rect x="40" y="25" width="4" height="1" fill="#604549"/>
      <rect x="40" y="26" width="1" height="1" fill="#7a6b5a"/>
      <rect x="41" y="26" width="3" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="40" y="27" width="1" height="1" fill="#7a6b5a"/>
      <rect x="41" y="27" width="3" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="40" y="28" width="1" height="1" fill="#7a6b5a"/>
      <rect x="41" y="28" width="3" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="40" y="29" width="1" height="1" fill="#7a6b5a"/>
      <rect x="41" y="29" width="3" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="40" y="30" width="1" height="1" fill="#7a6b5a"/>
      <rect x="41" y="30" width="3" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="40" y="31" width="1" height="1" fill="#7a6b5a"/>
      <rect x="41" y="31" width="3" height="1" fill="#80705f" class="colorizable-skin"/>

      <!-- ARM_R_LEFT (4x12) at (48,20) -->
      <rect x="48" y="20" width="4" height="1" fill="#705055"/>
      <rect x="48" y="21" width="4" height="1" fill="#705055"/>
      <rect x="48" y="22" width="4" height="1" fill="#705055"/>
      <rect x="48" y="23" width="4" height="1" fill="#705055"/>
      <rect x="48" y="24" width="4" height="1" fill="#705055"/>
      <rect x="48" y="25" width="4" height="1" fill="#705055"/>
      <rect x="48" y="26" width="3" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="51" y="26" width="1" height="1" fill="#7a6b5a"/>
      <rect x="48" y="27" width="3" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="51" y="27" width="1" height="1" fill="#7a6b5a"/>
      <rect x="48" y="28" width="3" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="51" y="28" width="1" height="1" fill="#7a6b5a"/>
      <rect x="48" y="29" width="3" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="51" y="29" width="1" height="1" fill="#7a6b5a"/>
      <rect x="48" y="30" width="3" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="51" y="30" width="1" height="1" fill="#7a6b5a"/>
      <rect x="48" y="31" width="3" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="51" y="31" width="1" height="1" fill="#7a6b5a"/>

      <!-- BRAZO IZQUIERDO -->
      <!-- ARM_L_TOP (4x4) at (36,48) - Hombro con mechones -->
      <rect x="36" y="48" width="2" height="1" fill="#783636"/>
      <rect x="38" y="48" width="2" height="1" fill="#705055"/>
      <rect x="36" y="49" width="1" height="1" fill="#783636"/>
      <rect x="37" y="49" width="3" height="1" fill="#705055"/>
      <rect x="36" y="50" width="1" height="1" fill="#783636"/>
      <rect x="37" y="50" width="3" height="1" fill="#705055"/>
      <rect x="36" y="51" width="1" height="1" fill="#783636"/>
      <rect x="37" y="51" width="3" height="1" fill="#705055"/>

      <!-- ARM_L_BOTTOM (4x4) at (40,48) -->
      <rect x="40" y="48" width="4" height="4" fill="#706253" class="colorizable-skin"/>

      <!-- ARM_L_FRONT (4x12) at (36,52) -->
      <rect x="36" y="52" width="4" height="1" fill="#705055"/>
      <rect x="36" y="53" width="4" height="1" fill="#705055"/>
      <rect x="36" y="54" width="4" height="1" fill="#705055"/>
      <rect x="36" y="55" width="4" height="1" fill="#705055"/>
      <rect x="36" y="56" width="4" height="1" fill="#705055"/>
      <rect x="36" y="57" width="4" height="1" fill="#604549"/>
      <rect x="36" y="58" width="1" height="1" fill="#907e6b" class="colorizable-skin"/>
      <rect x="37" y="58" width="1" height="1" fill="#8d7c69" class="colorizable-skin"/>
      <rect x="38" y="58" width="2" height="1" fill="#907e6b" class="colorizable-skin"/>
      <rect x="36" y="59" width="1" height="1" fill="#907e6b" class="colorizable-skin"/>
      <rect x="37" y="59" width="1" height="1" fill="#8d7c69" class="colorizable-skin"/>
      <rect x="38" y="59" width="2" height="1" fill="#907e6b" class="colorizable-skin"/>
      <rect x="36" y="60" width="1" height="1" fill="#907e6b" class="colorizable-skin"/>
      <rect x="37" y="60" width="1" height="1" fill="#8d7c69" class="colorizable-skin"/>
      <rect x="38" y="60" width="2" height="1" fill="#907e6b" class="colorizable-skin"/>
      <rect x="36" y="61" width="1" height="1" fill="#907e6b" class="colorizable-skin"/>
      <rect x="37" y="61" width="1" height="1" fill="#8d7c69" class="colorizable-skin"/>
      <rect x="38" y="61" width="2" height="1" fill="#907e6b" class="colorizable-skin"/>
      <rect x="36" y="62" width="1" height="1" fill="#907e6b" class="colorizable-skin"/>
      <rect x="37" y="62" width="1" height="1" fill="#8d7c69" class="colorizable-skin"/>
      <rect x="38" y="62" width="2" height="1" fill="#907e6b" class="colorizable-skin"/>
      <rect x="36" y="63" width="1" height="1" fill="#907e6b" class="colorizable-skin"/>
      <rect x="37" y="63" width="1" height="1" fill="#8d7c69" class="colorizable-skin"/>
      <rect x="38" y="63" width="2" height="1" fill="#907e6b" class="colorizable-skin"/>

      <!-- ARM_L_BACK (4x12) at (44,52) -->
      <rect x="44" y="52" width="2" height="1" fill="#604549"/>
      <rect x="46" y="52" width="2" height="1" fill="#783636"/>
      <rect x="44" y="53" width="3" height="1" fill="#604549"/>
      <rect x="47" y="53" width="1" height="1" fill="#783636"/>
      <rect x="44" y="54" width="3" height="1" fill="#604549"/>
      <rect x="47" y="54" width="1" height="1" fill="#783636"/>
      <rect x="44" y="55" width="4" height="1" fill="#604549"/>
      <rect x="44" y="56" width="4" height="1" fill="#604549"/>
      <rect x="44" y="57" width="4" height="1" fill="#553e41"/>
      <rect x="44" y="58" width="4" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="44" y="59" width="4" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="44" y="60" width="4" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="44" y="61" width="4" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="44" y="62" width="4" height="1" fill="#706253" class="colorizable-skin"/>
      <rect x="44" y="63" width="4" height="1" fill="#706253" class="colorizable-skin"/>

      <!-- ARM_L_RIGHT (4x12) at (32,52) -->
      <rect x="32" y="52" width="4" height="1" fill="#705055"/>
      <rect x="32" y="53" width="4" height="1" fill="#705055"/>
      <rect x="32" y="54" width="4" height="1" fill="#705055"/>
      <rect x="32" y="55" width="4" height="1" fill="#705055"/>
      <rect x="32" y="56" width="4" height="1" fill="#705055"/>
      <rect x="32" y="57" width="4" height="1" fill="#705055"/>
      <rect x="32" y="58" width="1" height="1" fill="#7a6b5a"/>
      <rect x="33" y="58" width="3" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="32" y="59" width="1" height="1" fill="#7a6b5a"/>
      <rect x="33" y="59" width="3" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="32" y="60" width="1" height="1" fill="#7a6b5a"/>
      <rect x="33" y="60" width="3" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="32" y="61" width="1" height="1" fill="#7a6b5a"/>
      <rect x="33" y="61" width="3" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="32" y="62" width="1" height="1" fill="#7a6b5a"/>
      <rect x="33" y="62" width="3" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="32" y="63" width="1" height="1" fill="#7a6b5a"/>
      <rect x="33" y="63" width="3" height="1" fill="#80705f" class="colorizable-skin"/>

      <!-- ARM_L_LEFT (4x12) at (40,52) -->
      <rect x="40" y="52" width="4" height="1" fill="#705055"/>
      <rect x="40" y="53" width="4" height="1" fill="#705055"/>
      <rect x="40" y="54" width="4" height="1" fill="#705055"/>
      <rect x="40" y="55" width="4" height="1" fill="#705055"/>
      <rect x="40" y="56" width="4" height="1" fill="#705055"/>
      <rect x="40" y="57" width="4" height="1" fill="#604549"/>
      <rect x="40" y="58" width="3" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="43" y="58" width="1" height="1" fill="#7a6b5a"/>
      <rect x="40" y="59" width="3" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="43" y="59" width="1" height="1" fill="#7a6b5a"/>
      <rect x="40" y="60" width="3" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="43" y="60" width="1" height="1" fill="#7a6b5a"/>
      <rect x="40" y="61" width="3" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="43" y="61" width="1" height="1" fill="#7a6b5a"/>
      <rect x="40" y="62" width="3" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="43" y="62" width="1" height="1" fill="#7a6b5a"/>
      <rect x="40" y="63" width="3" height="1" fill="#80705f" class="colorizable-skin"/>
      <rect x="43" y="63" width="1" height="1" fill="#7a6b5a"/>
    </svg>
  `;
}

/**
 * Generates complete outfit - Type Lob Chic: V-neck top + long sleeves + miniskirt + shoes
 * Colors in grayscale for colorization
 */
export function generateDress_VneckFemale_01(): string {
  return `
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
      <!-- ========== TORSO FRONTAL (8x12) at (20,20) ========== -->
      <!-- y=20: Escote V - bordes ropa, centro piel -->
      <rect x="20" y="20" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="23" y="20" width="2" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="27" y="20" width="1" height="1" fill="#707070" class="colorizable-clothing"/>

      <!-- y=21: Escote V más cerrado -->
      <rect x="20" y="21" width="2" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="26" y="21" width="2" height="1" fill="#707070" class="colorizable-clothing"/>

      <!-- y=22-31: Cuerpo completo con degradado de sombras -->
      <rect x="20" y="22" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="21" y="22" width="1" height="1" fill="#808080" class="colorizable-clothing"/>
      <rect x="22" y="22" width="1" height="1" fill="#757575" class="colorizable-clothing"/>
      <rect x="23" y="22" width="2" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="25" y="22" width="1" height="1" fill="#757575" class="colorizable-clothing"/>
      <rect x="26" y="22" width="1" height="1" fill="#808080" class="colorizable-clothing"/>
      <rect x="27" y="22" width="1" height="1" fill="#707070" class="colorizable-clothing"/>

      <rect x="20" y="23" width="1" height="1" fill="#757575" class="colorizable-clothing"/>
      <rect x="21" y="23" width="1" height="1" fill="#909090" class="colorizable-clothing"/>
      <rect x="22" y="23" width="1" height="1" fill="#808080" class="colorizable-clothing"/>
      <rect x="23" y="23" width="2" height="1" fill="#757575" class="colorizable-clothing"/>
      <rect x="25" y="23" width="1" height="1" fill="#808080" class="colorizable-clothing"/>
      <rect x="26" y="23" width="1" height="1" fill="#909090" class="colorizable-clothing"/>
      <rect x="27" y="23" width="1" height="1" fill="#757575" class="colorizable-clothing"/>

      <rect x="20" y="24" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="21" y="24" width="1" height="1" fill="#757575" class="colorizable-clothing"/>
      <rect x="22" y="24" width="2" height="1" fill="#757575" class="colorizable-clothing"/>
      <rect x="24" y="24" width="2" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="26" y="24" width="1" height="1" fill="#757575" class="colorizable-clothing"/>
      <rect x="27" y="24" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>

      <rect x="20" y="25" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="21" y="25" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="22" y="25" width="2" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="24" y="25" width="2" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="26" y="25" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="27" y="25" width="1" height="1" fill="#555555" class="colorizable-clothing"/>

      <rect x="20" y="26" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="21" y="26" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="22" y="26" width="2" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="24" y="26" width="2" height="1" fill="#5a5a5a" class="colorizable-clothing"/>
      <rect x="26" y="26" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="27" y="26" width="1" height="1" fill="#505050" class="colorizable-clothing"/>

      <rect x="20" y="27" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="21" y="27" width="1" height="1" fill="#5a5a5a" class="colorizable-clothing"/>
      <rect x="22" y="27" width="2" height="1" fill="#5a5a5a" class="colorizable-clothing"/>
      <rect x="24" y="27" width="2" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="26" y="27" width="1" height="1" fill="#5a5a5a" class="colorizable-clothing"/>
      <rect x="27" y="27" width="1" height="1" fill="#505050" class="colorizable-clothing"/>

      <rect x="20" y="28" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="21" y="28" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="22" y="28" width="1" height="1" fill="#5a5a5a" class="colorizable-clothing"/>
      <rect x="23" y="28" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="24" y="28" width="1" height="1" fill="#5a5a5a" class="colorizable-clothing"/>
      <rect x="25" y="28" width="1" height="1" fill="#5a5a5a" class="colorizable-clothing"/>
      <rect x="26" y="28" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="27" y="28" width="1" height="1" fill="#555555" class="colorizable-clothing"/>

      <rect x="20" y="29" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="21" y="29" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="22" y="29" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="23" y="29" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="24" y="29" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="25" y="29" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="26" y="29" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="27" y="29" width="1" height="1" fill="#555555" class="colorizable-clothing"/>

      <rect x="20" y="30" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="21" y="30" width="1" height="1" fill="#808080" class="colorizable-clothing"/>
      <rect x="22" y="30" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="23" y="30" width="1" height="1" fill="#808080" class="colorizable-clothing"/>
      <rect x="24" y="30" width="1" height="1" fill="#5a5a5a" class="colorizable-clothing"/>
      <rect x="25" y="30" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="26" y="30" width="1" height="1" fill="#808080" class="colorizable-clothing"/>
      <rect x="27" y="30" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>

      <rect x="20" y="31" width="1" height="1" fill="#5a5a5a" class="colorizable-clothing"/>
      <rect x="21" y="31" width="1" height="1" fill="#808080" class="colorizable-clothing"/>
      <rect x="22" y="31" width="1" height="1" fill="#5a5a5a" class="colorizable-clothing"/>
      <rect x="23" y="31" width="1" height="1" fill="#808080" class="colorizable-clothing"/>
      <rect x="24" y="31" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="25" y="31" width="1" height="1" fill="#5a5a5a" class="colorizable-clothing"/>
      <rect x="26" y="31" width="1" height="1" fill="#808080" class="colorizable-clothing"/>
      <rect x="27" y="31" width="1" height="1" fill="#5a5a5a" class="colorizable-clothing"/>

      <!-- ========== TORSO DERECHO (4x12) at (16,20) ========== -->
      <rect x="16" y="20" width="4" height="2" fill="#808080" class="colorizable-clothing"/>
      <rect x="16" y="22" width="4" height="2" fill="#757575" class="colorizable-clothing"/>
      <rect x="16" y="24" width="4" height="2" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="16" y="26" width="4" height="2" fill="#606060" class="colorizable-clothing"/>
      <rect x="16" y="28" width="4" height="2" fill="#555555" class="colorizable-clothing"/>
      <rect x="16" y="30" width="4" height="2" fill="#606060" class="colorizable-clothing"/>

      <!-- ========== TORSO IZQUIERDO (4x12) at (28,20) ========== -->
      <rect x="28" y="20" width="4" height="2" fill="#808080" class="colorizable-clothing"/>
      <rect x="28" y="22" width="4" height="2" fill="#757575" class="colorizable-clothing"/>
      <rect x="28" y="24" width="4" height="2" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="28" y="26" width="4" height="2" fill="#606060" class="colorizable-clothing"/>
      <rect x="28" y="28" width="4" height="2" fill="#555555" class="colorizable-clothing"/>
      <rect x="28" y="30" width="4" height="2" fill="#606060" class="colorizable-clothing"/>

      <!-- ========== TORSO TRASERO (8x12) at (32,20) ========== -->
      <rect x="32" y="20" width="8" height="2" fill="#808080" class="colorizable-clothing"/>
      <rect x="32" y="22" width="8" height="2" fill="#757575" class="colorizable-clothing"/>
      <rect x="32" y="24" width="8" height="2" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="32" y="26" width="8" height="2" fill="#606060" class="colorizable-clothing"/>
      <rect x="32" y="28" width="8" height="2" fill="#555555" class="colorizable-clothing"/>
      <rect x="32" y="30" width="8" height="2" fill="#606060" class="colorizable-clothing"/>

      <!-- ========== BRAZO DERECHO - MANGAS LARGAS (hasta y=28) ========== -->
      <!-- ARM_R_TOP (4x4) at (44,16) -->
      <rect x="44" y="16" width="4" height="4" fill="#808080" class="colorizable-clothing"/>
      <!-- ARM_R_BOTTOM (4x4) at (48,16) -->
      <rect x="48" y="16" width="4" height="4" fill="#707070" class="colorizable-clothing"/>

      <!-- ARM_R_RIGHT (4x12) at (40,20) - Manga larga -->
      <rect x="40" y="20" width="4" height="3" fill="#808080" class="colorizable-clothing"/>
      <rect x="40" y="23" width="4" height="3" fill="#707070" class="colorizable-clothing"/>
      <rect x="40" y="26" width="4" height="3" fill="#606060" class="colorizable-clothing"/>

      <!-- ARM_R_FRONT (4x12) at (44,20) -->
      <rect x="44" y="20" width="1" height="1" fill="#808080" class="colorizable-clothing"/>
      <rect x="45" y="20" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="46" y="20" width="2" height="1" fill="#808080" class="colorizable-clothing"/>
      <rect x="44" y="21" width="4" height="5" fill="#808080" class="colorizable-clothing"/>
      <rect x="45" y="21" width="1" height="5" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="44" y="26" width="4" height="2" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="45" y="26" width="1" height="2" fill="#555555" class="colorizable-clothing"/>
      <rect x="44" y="28" width="4" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="45" y="28" width="1" height="1" fill="#555555" class="colorizable-clothing"/>

      <!-- ARM_R_LEFT (4x12) at (48,20) -->
      <rect x="48" y="20" width="4" height="6" fill="#808080" class="colorizable-clothing"/>
      <rect x="48" y="26" width="4" height="3" fill="#6a6a6a" class="colorizable-clothing"/>

      <!-- ARM_R_BACK (4x12) at (52,20) -->
      <rect x="52" y="20" width="4" height="6" fill="#707070" class="colorizable-clothing"/>
      <rect x="52" y="26" width="4" height="3" fill="#606060" class="colorizable-clothing"/>

      <!-- ========== BRAZO IZQUIERDO - MANGAS LARGAS (hasta y=60) ========== -->
      <!-- ARM_L_TOP (4x4) at (36,48) -->
      <rect x="36" y="48" width="4" height="4" fill="#808080" class="colorizable-clothing"/>
      <!-- ARM_L_BOTTOM (4x4) at (40,48) -->
      <rect x="40" y="48" width="4" height="4" fill="#707070" class="colorizable-clothing"/>

      <!-- ARM_L_RIGHT (4x12) at (32,52) -->
      <rect x="32" y="52" width="4" height="3" fill="#808080" class="colorizable-clothing"/>
      <rect x="32" y="55" width="4" height="3" fill="#707070" class="colorizable-clothing"/>
      <rect x="32" y="58" width="4" height="2" fill="#606060" class="colorizable-clothing"/>

      <!-- ARM_L_FRONT (4x12) at (36,52) -->
      <rect x="36" y="52" width="1" height="1" fill="#808080" class="colorizable-clothing"/>
      <rect x="37" y="52" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="38" y="52" width="2" height="1" fill="#808080" class="colorizable-clothing"/>
      <rect x="36" y="53" width="4" height="5" fill="#808080" class="colorizable-clothing"/>
      <rect x="37" y="53" width="1" height="5" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="36" y="58" width="4" height="2" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="37" y="58" width="1" height="2" fill="#555555" class="colorizable-clothing"/>

      <!-- ARM_L_LEFT (4x12) at (40,52) -->
      <rect x="40" y="52" width="4" height="6" fill="#808080" class="colorizable-clothing"/>
      <rect x="40" y="58" width="4" height="2" fill="#6a6a6a" class="colorizable-clothing"/>

      <!-- ARM_L_BACK (4x12) at (44,52) -->
      <rect x="44" y="52" width="4" height="6" fill="#707070" class="colorizable-clothing"/>
      <rect x="44" y="58" width="4" height="2" fill="#606060" class="colorizable-clothing"/>

      <!-- ========== PIERNA DERECHA - MINIFALDA + ZAPATOS ========== -->
      <!-- LEG_R_RIGHT (4x12) at (0,20) -->
      <rect x="0" y="20" width="4" height="5" fill="#707070" class="colorizable-clothing"/>
      <!-- Zapatos -->
      <rect x="0" y="28" width="4" height="2" fill="#606060" class="colorizable-shoes"/>
      <rect x="0" y="30" width="4" height="2" fill="#505050" class="colorizable-shoes"/>

      <!-- LEG_R_FRONT (4x12) at (4,20) -->
      <rect x="4" y="20" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="5" y="20" width="1" height="1" fill="#808080" class="colorizable-clothing"/>
      <rect x="6" y="20" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="7" y="20" width="1" height="1" fill="#808080" class="colorizable-clothing"/>
      <rect x="4" y="21" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="5" y="21" width="1" height="1" fill="#808080" class="colorizable-clothing"/>
      <rect x="6" y="21" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="7" y="21" width="1" height="1" fill="#808080" class="colorizable-clothing"/>
      <rect x="4" y="22" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="5" y="22" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="6" y="22" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="7" y="22" width="1" height="1" fill="#808080" class="colorizable-clothing"/>
      <rect x="4" y="23" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="5" y="23" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="6" y="23" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="7" y="23" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="4" y="24" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="5" y="24" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="6" y="24" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="7" y="24" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <!-- Zapatos -->
      <rect x="4" y="28" width="4" height="1" fill="#606060" class="colorizable-shoes"/>
      <rect x="4" y="29" width="4" height="1" fill="#454545" class="colorizable-shoes"/>
      <rect x="4" y="30" width="4" height="1" fill="#606060" class="colorizable-shoes"/>
      <rect x="4" y="31" width="4" height="1" fill="#505050" class="colorizable-shoes"/>

      <!-- LEG_R_LEFT (4x12) at (8,20) -->
      <rect x="8" y="20" width="4" height="5" fill="#707070" class="colorizable-clothing"/>
      <!-- Zapatos -->
      <rect x="8" y="28" width="4" height="2" fill="#606060" class="colorizable-shoes"/>
      <rect x="8" y="30" width="4" height="2" fill="#505050" class="colorizable-shoes"/>

      <!-- LEG_R_BACK (4x12) at (12,20) -->
      <rect x="12" y="20" width="4" height="5" fill="#606060" class="colorizable-clothing"/>
      <!-- Zapatos -->
      <rect x="12" y="28" width="4" height="2" fill="#555555" class="colorizable-shoes"/>
      <rect x="12" y="30" width="4" height="2" fill="#454545" class="colorizable-shoes"/>

      <!-- ========== PIERNA IZQUIERDA - MINIFALDA + ZAPATOS ========== -->
      <!-- LEG_L_RIGHT (4x12) at (16,52) -->
      <rect x="16" y="52" width="4" height="5" fill="#707070" class="colorizable-clothing"/>
      <!-- Zapatos -->
      <rect x="16" y="60" width="4" height="2" fill="#606060" class="colorizable-shoes"/>
      <rect x="16" y="62" width="4" height="2" fill="#505050" class="colorizable-shoes"/>

      <!-- LEG_L_FRONT (4x12) at (20,52) -->
      <rect x="20" y="52" width="1" height="1" fill="#808080" class="colorizable-clothing"/>
      <rect x="21" y="52" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="22" y="52" width="1" height="1" fill="#808080" class="colorizable-clothing"/>
      <rect x="23" y="52" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="20" y="53" width="4" height="1" fill="#808080" class="colorizable-clothing"/>
      <rect x="21" y="53" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="20" y="54" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="21" y="54" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="22" y="54" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="23" y="54" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="20" y="55" width="4" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="21" y="55" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="20" y="56" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="21" y="56" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="22" y="56" width="1" height="1" fill="#6a6a6a" class="colorizable-clothing"/>
      <rect x="23" y="56" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <!-- Zapatos -->
      <rect x="20" y="60" width="4" height="1" fill="#606060" class="colorizable-shoes"/>
      <rect x="20" y="61" width="4" height="1" fill="#454545" class="colorizable-shoes"/>
      <rect x="20" y="62" width="4" height="1" fill="#606060" class="colorizable-shoes"/>
      <rect x="20" y="63" width="4" height="1" fill="#505050" class="colorizable-shoes"/>

      <!-- LEG_L_LEFT (4x12) at (24,52) -->
      <rect x="24" y="52" width="4" height="5" fill="#707070" class="colorizable-clothing"/>
      <!-- Zapatos -->
      <rect x="24" y="60" width="4" height="2" fill="#606060" class="colorizable-shoes"/>
      <rect x="24" y="62" width="4" height="2" fill="#505050" class="colorizable-shoes"/>

      <!-- LEG_L_BACK (4x12) at (28,52) -->
      <rect x="28" y="52" width="4" height="5" fill="#606060" class="colorizable-clothing"/>
      <!-- Zapatos -->
      <rect x="28" y="60" width="4" height="2" fill="#555555" class="colorizable-shoes"/>
      <rect x="28" y="62" width="4" height="2" fill="#454545" class="colorizable-shoes"/>

      <!-- ========== SEGUNDA CAPA (OVERLAY) - Efecto 2D/Textura ========== -->

      <!-- OVERLAY TORSO FRONTAL (x=20-27, y=36-47) -->
      <rect x="20" y="36" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="23" y="36" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="25" y="36" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="27" y="36" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="21" y="37" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="26" y="37" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="21" y="38" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="22" y="38" width="1" height="1" fill="#606060" class="colorizable-clothing"/>
      <rect x="23" y="38" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="24" y="38" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="25" y="38" width="1" height="1" fill="#606060" class="colorizable-clothing"/>
      <rect x="26" y="38" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="20" y="39" width="1" height="1" fill="#606060" class="colorizable-clothing"/>
      <rect x="21" y="39" width="1" height="1" fill="#808080" class="colorizable-clothing"/>
      <rect x="22" y="39" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="25" y="39" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="26" y="39" width="1" height="1" fill="#808080" class="colorizable-clothing"/>
      <rect x="27" y="39" width="1" height="1" fill="#606060" class="colorizable-clothing"/>
      <rect x="20" y="40" width="1" height="1" fill="#606060" class="colorizable-clothing"/>
      <rect x="21" y="40" width="1" height="1" fill="#808080" class="colorizable-clothing"/>
      <rect x="22" y="40" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="25" y="40" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="26" y="40" width="1" height="1" fill="#808080" class="colorizable-clothing"/>
      <rect x="27" y="40" width="1" height="1" fill="#606060" class="colorizable-clothing"/>
      <rect x="20" y="41" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="21" y="41" width="1" height="1" fill="#606060" class="colorizable-clothing"/>
      <rect x="26" y="41" width="1" height="1" fill="#606060" class="colorizable-clothing"/>
      <rect x="27" y="41" width="1" height="1" fill="#555555" class="colorizable-clothing"/>

      <!-- OVERLAY TORSO DERECHO (x=16-19, y=36-47) -->
      <rect x="16" y="36" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="16" y="38" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="19" y="39" width="1" height="1" fill="#606060" class="colorizable-clothing"/>
      <rect x="16" y="40" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="19" y="40" width="1" height="1" fill="#606060" class="colorizable-clothing"/>
      <rect x="19" y="41" width="1" height="1" fill="#555555" class="colorizable-clothing"/>

      <!-- OVERLAY TORSO IZQUIERDO (x=28-31, y=36-47) -->
      <rect x="31" y="37" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="28" y="39" width="1" height="1" fill="#606060" class="colorizable-clothing"/>
      <rect x="31" y="39" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="28" y="40" width="1" height="1" fill="#606060" class="colorizable-clothing"/>
      <rect x="28" y="41" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="31" y="41" width="1" height="1" fill="#707070" class="colorizable-clothing"/>

      <!-- OVERLAY TORSO TRASERO (x=32-39, y=36-47) -->
      <rect x="33" y="36" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="38" y="36" width="1" height="1" fill="#757575" class="colorizable-clothing"/>
      <rect x="39" y="36" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="32" y="37" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="33" y="37" width="1" height="1" fill="#757575" class="colorizable-clothing"/>
      <rect x="36" y="37" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="38" y="37" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="33" y="38" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="35" y="38" width="1" height="1" fill="#757575" class="colorizable-clothing"/>
      <rect x="36" y="38" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="39" y="38" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="32" y="39" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="35" y="39" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="38" y="39" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="33" y="40" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="36" y="40" width="1" height="1" fill="#757575" class="colorizable-clothing"/>
      <rect x="39" y="40" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="32" y="41" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="35" y="41" width="1" height="1" fill="#707070" class="colorizable-clothing"/>

      <!-- OVERLAY BRAZO DERECHO - ARM_R_RIGHT (x=40-43, y=36-47) -->
      <rect x="40" y="38" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="41" y="38" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="42" y="38" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="43" y="38" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="40" y="40" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="41" y="40" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="42" y="40" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="43" y="40" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="40" y="41" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="41" y="41" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="42" y="41" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="43" y="41" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="40" y="43" width="1" height="1" fill="#454545" class="colorizable-clothing"/>
      <rect x="41" y="43" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="42" y="43" width="1" height="1" fill="#454545" class="colorizable-clothing"/>
      <rect x="43" y="43" width="1" height="1" fill="#505050" class="colorizable-clothing"/>

      <!-- OVERLAY BRAZO DERECHO - ARM_R_FRONT (x=44-47, y=36-47) -->
      <rect x="44" y="38" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="45" y="38" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="46" y="38" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="47" y="38" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="44" y="40" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="45" y="40" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="46" y="40" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="47" y="40" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="44" y="41" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="45" y="41" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="46" y="41" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="47" y="41" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="44" y="43" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="45" y="43" width="1" height="1" fill="#454545" class="colorizable-clothing"/>
      <rect x="46" y="43" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="47" y="43" width="1" height="1" fill="#555555" class="colorizable-clothing"/>

      <!-- OVERLAY BRAZO DERECHO - ARM_R_LEFT (x=48-51, y=36-47) -->
      <rect x="48" y="38" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="49" y="38" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="50" y="38" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="51" y="38" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="48" y="40" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="49" y="40" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="50" y="40" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="51" y="40" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="48" y="41" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="49" y="41" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="50" y="41" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="51" y="41" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="48" y="43" width="1" height="1" fill="#454545" class="colorizable-clothing"/>
      <rect x="49" y="43" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="50" y="43" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="51" y="43" width="1" height="1" fill="#454545" class="colorizable-clothing"/>

      <!-- OVERLAY BRAZO DERECHO - ARM_R_BACK (x=52-55, y=36-47) -->
      <rect x="52" y="38" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="53" y="38" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="52" y="40" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="53" y="40" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="52" y="41" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="53" y="41" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="52" y="43" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="53" y="43" width="1" height="1" fill="#454545" class="colorizable-clothing"/>

      <!-- OVERLAY BRAZO IZQUIERDO - ARM_L_RIGHT (x=48-51, y=52-63) -->
      <rect x="48" y="54" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="49" y="54" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="50" y="54" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="51" y="54" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="48" y="56" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="49" y="56" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="50" y="56" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="51" y="56" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="48" y="57" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="49" y="57" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="50" y="57" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="51" y="57" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="48" y="59" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="49" y="59" width="1" height="1" fill="#454545" class="colorizable-clothing"/>
      <rect x="50" y="59" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="51" y="59" width="1" height="1" fill="#454545" class="colorizable-clothing"/>

      <!-- OVERLAY BRAZO IZQUIERDO - ARM_L_FRONT (x=52-55, y=52-63) -->
      <rect x="52" y="54" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="53" y="54" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="54" y="54" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="55" y="54" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="52" y="56" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="53" y="56" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="54" y="56" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="55" y="56" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="52" y="57" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="53" y="57" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="54" y="57" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="55" y="57" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="52" y="59" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="53" y="59" width="1" height="1" fill="#454545" class="colorizable-clothing"/>
      <rect x="54" y="59" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="55" y="59" width="1" height="1" fill="#555555" class="colorizable-clothing"/>

      <!-- OVERLAY BRAZO IZQUIERDO - ARM_L_LEFT (x=56-59, y=52-63) -->
      <rect x="56" y="54" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="57" y="54" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="58" y="54" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="59" y="54" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="56" y="56" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="57" y="56" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="58" y="56" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="59" y="56" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="56" y="57" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="57" y="57" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="58" y="57" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="59" y="57" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="56" y="59" width="1" height="1" fill="#454545" class="colorizable-clothing"/>
      <rect x="57" y="59" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="58" y="59" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="59" y="59" width="1" height="1" fill="#454545" class="colorizable-clothing"/>

      <!-- OVERLAY BRAZO IZQUIERDO - ARM_L_BACK (x=60-63, y=52-63) -->
      <rect x="60" y="54" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="61" y="54" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="60" y="56" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="61" y="56" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="60" y="57" width="1" height="1" fill="#707070" class="colorizable-clothing"/>
      <rect x="61" y="57" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="60" y="59" width="1" height="1" fill="#555555" class="colorizable-clothing"/>
      <rect x="61" y="59" width="1" height="1" fill="#454545" class="colorizable-clothing"/>

      <!-- OVERLAY PIERNA DERECHA (x=4-7, y=36-47) - Minifalda -->
      <rect x="4" y="37" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="4" y="38" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="6" y="38" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="4" y="39" width="1" height="1" fill="#454545" class="colorizable-clothing"/>
      <rect x="6" y="39" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="4" y="40" width="1" height="1" fill="#404040" class="colorizable-clothing"/>
      <rect x="5" y="40" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="6" y="40" width="1" height="1" fill="#454545" class="colorizable-clothing"/>
      <rect x="5" y="41" width="1" height="1" fill="#454545" class="colorizable-clothing"/>
      <rect x="6" y="41" width="1" height="1" fill="#454545" class="colorizable-clothing"/>
      <rect x="7" y="41" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="6" y="42" width="1" height="1" fill="#454545" class="colorizable-clothing"/>
      <rect x="7" y="42" width="1" height="1" fill="#404040" class="colorizable-clothing"/>
      <!-- Overlay zapatos -->
      <rect x="4" y="46" width="1" height="1" fill="#606060" class="colorizable-shoes"/>
      <rect x="5" y="46" width="1" height="1" fill="#555555" class="colorizable-shoes"/>
      <rect x="6" y="46" width="1" height="1" fill="#555555" class="colorizable-shoes"/>
      <rect x="7" y="46" width="1" height="1" fill="#606060" class="colorizable-shoes"/>
      <rect x="4" y="47" width="1" height="1" fill="#555555" class="colorizable-shoes"/>
      <rect x="5" y="47" width="1" height="1" fill="#454545" class="colorizable-shoes"/>
      <rect x="6" y="47" width="1" height="1" fill="#454545" class="colorizable-shoes"/>
      <rect x="7" y="47" width="1" height="1" fill="#555555" class="colorizable-shoes"/>

      <!-- OVERLAY PIERNA IZQUIERDA (x=4-7, y=52-63) - Minifalda -->
      <rect x="7" y="53" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="5" y="54" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="7" y="54" width="1" height="1" fill="#454545" class="colorizable-clothing"/>
      <rect x="5" y="55" width="1" height="1" fill="#454545" class="colorizable-clothing"/>
      <rect x="7" y="55" width="1" height="1" fill="#454545" class="colorizable-clothing"/>
      <rect x="5" y="56" width="1" height="1" fill="#454545" class="colorizable-clothing"/>
      <rect x="7" y="56" width="1" height="1" fill="#404040" class="colorizable-clothing"/>
      <rect x="4" y="57" width="1" height="1" fill="#505050" class="colorizable-clothing"/>
      <rect x="5" y="57" width="1" height="1" fill="#454545" class="colorizable-clothing"/>
      <rect x="6" y="57" width="1" height="1" fill="#454545" class="colorizable-clothing"/>
      <rect x="4" y="58" width="1" height="1" fill="#404040" class="colorizable-clothing"/>
      <rect x="5" y="58" width="1" height="1" fill="#454545" class="colorizable-clothing"/>
      <!-- Overlay zapatos -->
      <rect x="4" y="62" width="1" height="1" fill="#606060" class="colorizable-shoes"/>
      <rect x="5" y="62" width="1" height="1" fill="#555555" class="colorizable-shoes"/>
      <rect x="6" y="62" width="1" height="1" fill="#555555" class="colorizable-shoes"/>
      <rect x="7" y="62" width="1" height="1" fill="#606060" class="colorizable-shoes"/>
      <rect x="4" y="63" width="1" height="1" fill="#555555" class="colorizable-shoes"/>
      <rect x="5" y="63" width="1" height="1" fill="#454545" class="colorizable-shoes"/>
      <rect x="6" y="63" width="1" height="1" fill="#454545" class="colorizable-shoes"/>
      <rect x="7" y="63" width="1" height="1" fill="#555555" class="colorizable-shoes"/>
    </svg>
  `;
}

// ============================================================================
// GENERADOR Y EXPORTADOR
// ============================================================================

/** Information of a component to generate */
interface ComponentInfo {
  id: string;
  category: ComponentCategory;
  generator: () => string;
  filename: string;
}

/** Complete catalog of components to generate */
export const COMPONENT_CATALOG: ComponentInfo[] = [
  // CABEZA BASE (piel)
  { id: 'head_base_01', category: 'head_base' as ComponentCategory, generator: generateHead_Base_01, filename: 'head_base_01.svg' },
  { id: 'head_buzz_cut', category: 'head_base' as ComponentCategory, generator: generateHead_BuzzCut, filename: 'head_buzz_cut.svg' },
  { id: 'head_female_01', category: 'head_base' as ComponentCategory, generator: generateHead_Female_01, filename: 'head_female_01.svg' },

  // OJOS
  { id: 'eyes_01', category: ComponentCategory.EYES, generator: generateEyes_01, filename: 'eyes_01.svg' },
  { id: 'eyes_02', category: ComponentCategory.EYES, generator: generateEyes_02, filename: 'eyes_02.svg' },
  { id: 'eyes_03', category: ComponentCategory.EYES, generator: generateEyes_03, filename: 'eyes_03.svg' },

  // BOCAS
  { id: 'mouth_01', category: ComponentCategory.MOUTH, generator: generateMouth_01, filename: 'mouth_01.svg' },
  { id: 'eyes_female_01', category: ComponentCategory.EYES, generator: generateEyes_Female_01, filename: 'eyes_female_01.svg' },
  { id: 'mouth_empty', category: ComponentCategory.MOUTH, generator: generateMouth_Empty, filename: 'mouth_empty.svg' },
  { id: 'mouth_02', category: ComponentCategory.MOUTH, generator: generateMouth_02, filename: 'mouth_02.svg' },
  { id: 'mouth_03', category: ComponentCategory.MOUTH, generator: generateMouth_03, filename: 'mouth_03.svg' },

  // PELO - COMPONENTES ANTIGUOS (Legacy)
  { id: 'hair_front_01', category: ComponentCategory.HAIR_FRONT, generator: generateHairFront_01, filename: 'hair_front_01.svg' },
  { id: 'hair_front_02', category: ComponentCategory.HAIR_FRONT, generator: generateHairFront_02, filename: 'hair_front_02.svg' },
  { id: 'hair_top_01', category: ComponentCategory.HAIR_TOP, generator: generateHairTop_01, filename: 'hair_top_01.svg' },
  { id: 'hair_back_01', category: ComponentCategory.HAIR_BACK, generator: generateHairBack_01, filename: 'hair_back_01.svg' },

  // PELO - PEINADOS CORTOS (Short)
  { id: 'hair_short_01_pixie', category: ComponentCategory.HAIR_FRONT, generator: generateHairShort_01_Pixie, filename: 'hair_short_01_pixie.svg' },
  { id: 'hair_short_02_bob', category: ComponentCategory.HAIR_FRONT, generator: generateHairShort_02_BobCut, filename: 'hair_short_02_bob.svg' },
  { id: 'hair_short_03_buzz', category: ComponentCategory.HAIR_FRONT, generator: generateHairShort_03_BuzzCut, filename: 'hair_short_03_buzz.svg' },
  { id: 'hair_short_04_crew', category: ComponentCategory.HAIR_FRONT, generator: HairLib.generateHairShort_04_CrewCut, filename: 'hair_short_04_crew.svg' },
  { id: 'hair_short_05_caesar', category: ComponentCategory.HAIR_FRONT, generator: HairLib.generateHairShort_05_CaesarCut, filename: 'hair_short_05_caesar.svg' },
  { id: 'hair_short_06_undercut', category: ComponentCategory.HAIR_FRONT, generator: HairLib.generateHairShort_06_Undercut, filename: 'hair_short_06_undercut.svg' },
  { id: 'hair_short_07_bowl', category: ComponentCategory.HAIR_FRONT, generator: HairLib.generateHairShort_07_BowlCut, filename: 'hair_short_07_bowl.svg' },
  { id: 'hair_short_08_slicked', category: ComponentCategory.HAIR_FRONT, generator: HairLib.generateHairShort_08_SlickedBack, filename: 'hair_short_08_slicked.svg' },

  // PELO - PEINADOS MEDIOS (Medium)
  { id: 'hair_medium_01_lob', category: ComponentCategory.HAIR_FRONT, generator: HairLib.generateHairMedium_01_Lob, filename: 'hair_medium_01_lob.svg' },
  { id: 'hair_medium_03_shag', category: ComponentCategory.HAIR_FRONT, generator: HairLib.generateHairMedium_03_Shag, filename: 'hair_medium_03_shag.svg' },

  // PELO - PEINADOS LARGOS (Long) - HEAD
  { id: 'hair_long_01_straight', category: ComponentCategory.HAIR_FRONT, generator: HairLib.generateHairLong_01, filename: 'hair_long_01_straight.svg' },
  { id: 'hair_long_02_wavy', category: ComponentCategory.HAIR_FRONT, generator: HairLib.generateHairLong_02, filename: 'hair_long_02_wavy.svg' },

  // PELO - PEINADOS LARGOS (Long) - BODY (pelo cayendo en espalda/hombros)
  { id: 'hair_long_body_01_straight', category: ComponentCategory.HAIR_BODY, generator: HairLib.generateHairLongBody_01, filename: 'hair_long_body_01_straight.svg' },
  // { id: 'hair_long_body_02_wavy', category: ComponentCategory.HAIR_BODY, generator: HairLib.generateHairLongBody_02, filename: 'hair_long_body_02_wavy.svg' },

  // PELO - PEINADOS RECOGIDOS (Updos)
  // { id: 'hair_updo_01_high_ponytail', category: ComponentCategory.HAIR_BACK, generator: HairLib.generateHairUpdo_01_HighPonytail, filename: 'hair_updo_01_high_ponytail.svg' },
  // { id: 'hair_updo_05_messy_bun', category: ComponentCategory.HAIR_BACK, generator: HairLib.generateHairUpdo_05_MessyBun, filename: 'hair_updo_05_messy_bun.svg' },

  // CUERPO BASE
  { id: 'torso_slim_01', category: ComponentCategory.TORSO_BASE, generator: generateTorso_Slim_01, filename: 'torso_slim_01.svg' },
  { id: 'torso_athletic_01', category: ComponentCategory.TORSO_BASE, generator: generateTorso_Athletic_01, filename: 'torso_athletic_01.svg' },
  { id: 'torso_average_01', category: ComponentCategory.TORSO_BASE, generator: generateTorso_Average_01, filename: 'torso_average_01.svg' },
  { id: 'arms_slim_01', category: ComponentCategory.ARMS_BASE, generator: generateArms_Slim_01, filename: 'arms_slim_01.svg' },
  { id: 'arms_classic_01', category: ComponentCategory.ARMS_BASE, generator: generateArms_Classic_01, filename: 'arms_classic_01.svg' },
  { id: 'legs_average_01', category: ComponentCategory.LEGS_BASE, generator: generateLegs_Average_01, filename: 'legs_average_01.svg' },
  { id: 'legs_long_01', category: ComponentCategory.LEGS_BASE, generator: generateLegs_Long_01, filename: 'legs_long_01.svg' },

  // ROPA - SUPERIOR
  { id: 't_shirt_01', category: ComponentCategory.T_SHIRT, generator: generateTShirt_01, filename: 't_shirt_01.svg' },
  { id: 't_shirt_02', category: ComponentCategory.T_SHIRT, generator: generateTShirt_02, filename: 't_shirt_02.svg' },
  { id: 't_shirt_03', category: ComponentCategory.T_SHIRT, generator: generateTShirt_03, filename: 't_shirt_03.svg' },
  { id: 'shirt_01', category: ComponentCategory.SHIRT, generator: generateShirt_01, filename: 'shirt_01.svg' },
  { id: 'jacket_01', category: ComponentCategory.JACKET, generator: generateJacket_01, filename: 'jacket_01.svg' },
  { id: 'outfit_wavy_sleeves_01', category: ComponentCategory.SHIRT, generator: generateOutfit_WavySleeves_01, filename: 'outfit_wavy_sleeves_01.svg' },
  { id: 'dress_vneck_female_01', category: ComponentCategory.SHIRT, generator: generateDress_VneckFemale_01, filename: 'dress_vneck_female_01.svg' },

  // ROPA - INFERIOR
  { id: 'pants_01', category: ComponentCategory.PANTS, generator: generatePants_01, filename: 'pants_01.svg' },

  // ACCESORIOS - CABEZA
  { id: 'glasses_01', category: ComponentCategory.GLASSES, generator: generateGlasses_01, filename: 'glasses_01.svg' },
  { id: 'hat_01', category: ComponentCategory.HAT, generator: generateHat_01, filename: 'hat_01.svg' },

  // ACCESORIOS - EXTREMIDADES
  { id: 'gloves_01', category: ComponentCategory.GLOVES, generator: generateGloves_01, filename: 'gloves_01.svg' },
  { id: 'gloves_02', category: ComponentCategory.GLOVES, generator: generateGloves_02, filename: 'gloves_02.svg' },
  { id: 'shoes_01', category: ComponentCategory.SHOES, generator: generateShoes_01, filename: 'shoes_01.svg' },
  { id: 'shoes_02', category: ComponentCategory.SHOES, generator: generateShoes_02, filename: 'shoes_02.svg' },
  { id: 'boots_01', category: ComponentCategory.BOOTS, generator: generateBoots_01, filename: 'boots_01.svg' },
];

/** Generates all components and saves them to disk */
export async function generateAllComponents(outputDir: string): Promise<void> {
  console.log(`[Component Generator] Generando ${COMPONENT_CATALOG.length} componentes...`);

  for (const component of COMPONENT_CATALOG) {
    const categoryDir = path.join(outputDir, component.category);
    await fs.mkdir(categoryDir, { recursive: true });

    const svgContent = component.generator();
    const svgPath = path.join(categoryDir, component.filename);
    const pngPath = svgPath.replace('.svg', '.png');

    // Guardar SVG
    await fs.writeFile(svgPath, svgContent);

    // Convertir a PNG con Sharp
    await sharp(Buffer.from(svgContent))
      .png()
      .toFile(pngPath);

    console.log(`  ✓ ${component.id} → ${pngPath}`);
  }

  console.log('[Component Generator] ¡Generación completada!');
}