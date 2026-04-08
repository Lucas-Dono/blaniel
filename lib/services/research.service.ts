/**
 * Research Service - Sistema de investigación colaborativa
 */

import { nanoid } from "nanoid";
import { prisma } from '@/lib/prisma';

export interface CreateProjectData {
  title: string;
  description: string;
  category: string;
  tags: string[];
  objectives: string;
  methodology: string;
  openForContributions: boolean;
  requiredSkills?: string[];
}

export interface UpdateProjectData {
  title?: string;
  description?: string;
  category?: string;
  tags?: string[];
  objectives?: string;
  methodology?: string;
  findings?: string;
  conclusions?: string;
  openForContributions?: boolean;
  requiredSkills?: string[];
  status?: 'draft' | 'peer_review' | 'published' | 'archived';
}

export interface CreateDatasetData {
  name: string;
  description: string;
  format: string;
  fileUrl: string;
  fileSize: number;
  rowCount?: number;
  columnCount?: number;
  schema?: any;
}

export const ResearchService = {
  /**
   * Create research project
   */
  async createProject(leadAuthorId: string, data: CreateProjectData) {
    // Generate slug from title
    const slug = data.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50) + '-' + Math.random().toString(36).substring(2, 8);

    const project = await prisma.researchProject.create({
      data: {
        id: nanoid(),
        updatedAt: new Date(),
        leadAuthorId,
        title: data.title,
        slug,
        abstract: data.description || '',
        category: data.category,
        sections: data.objectives ? { objectives: data.objectives, methodology: data.methodology } : {},
        status: 'draft',
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    // Add leader as collaborator
    await prisma.researchContributor.create({
      data: {
        id: nanoid(),
        projectId: project.id,
        userId: leadAuthorId,
        role: 'lead',
      },
    });

    return project;
  },

  /**
   * Actualizar proyecto
   */
  async updateProject(projectId: string, userId: string, data: UpdateProjectData) {
    // Verificar permisos
    const contributor = await prisma.researchContributor.findFirst({
      where: {
        projectId,
        userId,
      },
    });

    if (!contributor) {
      throw new Error('No tienes permisos para editar este proyecto');
    }

    const updated = await prisma.researchProject.update({
      where: { id: projectId },
      data,
      include: {
        User: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        ResearchContributor: true,
      },
    });

    // Fetch user data for contributors separately
    const contributorUserIds = updated.ResearchContributor.map(c => c.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: contributorUserIds } },
      select: { id: true, name: true, image: true },
    });
    const usersMap = new Map(users.map(u => [u.id, u]));

    return {
      ...updated,
      contributors: updated.ResearchContributor.map(c => ({
        ...c,
        user: usersMap.get(c.userId) || null,
      })),
    };
  },

  /**
   * Obtener proyecto
   */
  async getProject(projectId: string, userId?: string) {
    const project = await prisma.researchProject.findUnique({
      where: { id: projectId },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        ResearchContributor: {
          orderBy: { addedAt: 'asc' },
        },
        ResearchDataset: {
          orderBy: { uploadedAt: 'desc' },
        },
        ResearchReview: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!project) {
      throw new Error('Proyecto no encontrado');
    }

    // Check if public or user is collaborator
    // Projects with "published" status are public
    if (project.status !== 'published') {
      const isContributor = project.ResearchContributor.some(c => c.userId === userId);
      if (!isContributor) {
        throw new Error('Este proyecto es privado');
      }
    }

    // Fetch user data for contributors and reviewers separately
    const contributorUserIds = project.ResearchContributor.map(c => c.userId);
    const reviewerUserIds = project.ResearchReview.map(r => r.reviewerId);
    const allUserIds = [...new Set([...contributorUserIds, ...reviewerUserIds])];

    const users = await prisma.user.findMany({
      where: { id: { in: allUserIds } },
      select: { id: true, name: true, image: true },
    });
    const usersMap = new Map(users.map(u => [u.id, u]));

    return {
      ...project,
      contributors: project.ResearchContributor.map(c => ({
        ...c,
        user: usersMap.get(c.userId) || null,
      })),
      reviews: project.ResearchReview.map(r => ({
        ...r,
        reviewer: usersMap.get(r.reviewerId) || null,
      })),
    };
  },

  /**
   * Listar proyectos
   */
  async listProjects(filters: {
    category?: string;
    tags?: string[];
    leadAuthorId?: string;
    status?: string;
    search?: string;
    openForContributions?: boolean;
  } = {}, page = 1, limit = 25) {
    const where: any = {
      status: 'published', // Only show published projects by default
    };

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.tags && filters.tags.length > 0) {
      where.tags = {
        hasSome: filters.tags,
      };
    }

    if (filters.leadAuthorId) {
      where.leadAuthorId = filters.leadAuthorId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.openForContributions !== undefined) {
      where.openForContributions = filters.openForContributions;
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { abstract: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [projects, total] = await Promise.all([
      prisma.researchProject.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          User: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          _count: {
            select: {
              ResearchContributor: true,
              ResearchDataset: true,
              ResearchReview: true,
            },
          },
        },
      }),
      prisma.researchProject.count({ where }),
    ]);

    return {
      projects,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Solicitar unirse como colaborador
   */
  async requestToJoin(projectId: string, userId: string, message: string) {
    const project = await prisma.researchProject.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error('Proyecto no encontrado');
    }

    if (!project.openForContributions) {
      throw new Error('Este proyecto no está buscando colaboradores');
    }

    // Verificar si ya es colaborador
    const existing = await prisma.researchContributor.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    if (existing) {
      throw new Error('Ya eres colaborador de este proyecto');
    }

    // Create solicitud (como contributor pendiente)
    const contributor = await prisma.researchContributor.create({
      data: {
        id: nanoid(),
        projectId,
        userId,
        role: 'pending',
        contribution: message,
      },
    });

    // Fetch user data separately
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        image: true,
      },
    });

    return {
      ...contributor,
      user,
    };
  },

  /**
   * Aceptar colaborador (solo líder)
   */
  async acceptContributor(projectId: string, contributorUserId: string, leadAuthorId: string, role: string = 'contributor') {
    const project = await prisma.researchProject.findUnique({
      where: { id: projectId },
    });

    if (!project || project.leadAuthorId !== leadAuthorId) {
      throw new Error('No tienes permisos para aceptar colaboradores');
    }

    const contributor = await prisma.researchContributor.update({
      where: {
        projectId_userId: {
          projectId,
          userId: contributorUserId,
        },
      },
      data: {
        role,
      },
    });

    return contributor;
  },

  /**
   * Rechazar/remover colaborador
   */
  async removeContributor(projectId: string, contributorUserId: string, leadAuthorId: string) {
    const project = await prisma.researchProject.findUnique({
      where: { id: projectId },
    });

    if (!project || project.leadAuthorId !== leadAuthorId) {
      throw new Error('No tienes permisos para remover colaboradores');
    }

    if (contributorUserId === leadAuthorId) {
      throw new Error('No puedes remover al líder del proyecto');
    }

    await prisma.researchContributor.delete({
      where: {
        projectId_userId: {
          projectId,
          userId: contributorUserId,
        },
      },
    });

    return { success: true };
  },

  /**
   * Añadir dataset
   */
  async addDataset(projectId: string, userId: string, data: CreateDatasetData) {
    // Verificar permisos
    const contributor = await prisma.researchContributor.findFirst({
      where: {
        projectId,
        userId,
        role: { not: 'pending' },
      },
    });

    if (!contributor) {
      throw new Error('No eres colaborador de este proyecto');
    }

    const dataset = await prisma.researchDataset.create({
      data: {
        id: nanoid(),
        projectId,
        uploaderId: userId,
        name: data.name,
        description: data.description,
        format: data.format,
        fileUrl: data.fileUrl,
        fileSize: data.fileSize,
        rowCount: data.rowCount,
        columnCount: data.columnCount,
        schema: data.schema,
      },
    });

    return dataset;
  },

  /**
   * Crear review de proyecto
   */
  async createReview(projectId: string, reviewerId: string, rating: number, review: string) {
    if (rating < 1 || rating > 5) {
      throw new Error('La calificación debe estar entre 1 y 5');
    }

    const project = await prisma.researchProject.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error('Proyecto no encontrado');
    }

    if (project.status !== 'peer_review' && project.status !== 'published' && project.status !== 'archived') {
      throw new Error('Solo puedes revisar proyectos en revisión o publicados');
    }

    // Create o actualizar review
    const existing = await prisma.researchReview.findFirst({
      where: {
        projectId,
        reviewerId,
      },
    });

    const projectReview = existing
      ? await prisma.researchReview.update({
          where: { id: existing.id },
          data: {
            rating,
            comments: review,
          },
        })
      : await prisma.researchReview.create({
          data: {
            id: nanoid(),
            projectId,
            reviewerId,
            rating,
            comments: review,
            decision: 'approve',
          },
        });

    // Note: averageRating and reviewCount fields don't exist in schema
    // They would need to be calculated on-the-fly when querying

    // Fetch reviewer data separately
    const reviewer = await prisma.user.findUnique({
      where: { id: reviewerId },
      select: {
        id: true,
        name: true,
        image: true,
      },
    });

    return {
      ...projectReview,
      reviewer,
    };
  },

  /**
   * Publicar proyecto (marcar como activo)
   */
  async publishProject(projectId: string, userId: string) {
    const project = await prisma.researchProject.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error('Proyecto no encontrado');
    }

    if (project.leadAuthorId !== userId) {
      throw new Error('Solo el líder puede publicar el proyecto');
    }

    const published = await prisma.researchProject.update({
      where: { id: projectId },
      data: {
        status: 'published',
        publishedAt: new Date(),
      },
    });

    return published;
  },

  /**
   * Marcar proyecto como completado
   */
  async completeProject(projectId: string, userId: string) {
    const project = await prisma.researchProject.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error('Proyecto no encontrado');
    }

    if (project.leadAuthorId !== userId) {
      throw new Error('Solo el líder puede completar el proyecto');
    }

    const completed = await prisma.researchProject.update({
      where: { id: projectId },
      data: {
        status: 'archived',
      },
    });

    return completed;
  },
};
