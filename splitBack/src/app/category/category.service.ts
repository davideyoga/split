import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Category } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

const DEFAULT_ICON = 'pricetag-outline';

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}

  // Categorie utilizzabili dal chiamante: le preconfigurate (ownerId null,
  // visibili a tutti) piu' le proprie. Le archiviate non compaiono.
  async findAvailable(userPublicId: string) {
    const user = await this.getUser(userPublicId);

    const categories = await this.prisma.category.findMany({
      where: {
        archived: false,
        OR: [{ ownerId: null }, { ownerId: user.id }],
      },
    });

    // Prima le preconfigurate (in ordine di seed), poi le custom in ordine
    // alfabetico. Le globali non si ordinano per nome: il nome visibile lo
    // produce il frontend traducendo lo slug.
    return categories
      .sort((a, b) => {
        if (a.ownerId === null && b.ownerId === null) return a.id - b.id;
        if (a.ownerId === null) return -1;
        if (b.ownerId === null) return 1;
        return (a.name ?? '').localeCompare(b.name ?? '');
      })
      .map((category) => this.toResponse(category));
  }

  async create(userPublicId: string, dto: CreateCategoryDto) {
    const user = await this.getUser(userPublicId);

    // @@unique([ownerId, name]) vale anche per le categorie archiviate: se
    // l'utente ricrea una categoria che aveva archiviato, la si riattiva invece
    // di sbattere contro il vincolo.
    const existing = await this.prisma.category.findUnique({
      where: { ownerId_name: { ownerId: user.id, name: dto.name } },
    });
    if (existing) {
      if (!existing.archived) {
        throw new ConflictException('Hai già una categoria con questo nome');
      }

      const restored = await this.prisma.category.update({
        where: { id: existing.id },
        data: {
          archived: false,
          ...(dto.icon ? { icon: dto.icon } : {}),
          ...(dto.color !== undefined ? { color: dto.color } : {}),
        },
      });
      return this.toResponse(restored);
    }

    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        icon: dto.icon ?? DEFAULT_ICON,
        color: dto.color,
        owner: { connect: { id: user.id } },
      },
    });

    return this.toResponse(category);
  }

  async update(
    userPublicId: string,
    categoryPublicId: string,
    dto: UpdateCategoryDto,
  ) {
    const category = await this.assertOwned(userPublicId, categoryPublicId);

    if (dto.name !== undefined && dto.name !== category.name) {
      const clash = await this.prisma.category.findFirst({
        where: { ownerId: category.ownerId, name: dto.name },
      });
      if (clash) {
        throw new ConflictException('Hai già una categoria con questo nome');
      }
    }

    const updated = await this.prisma.category.update({
      where: { id: category.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
      },
    });

    return this.toResponse(updated);
  }

  // Cancellazione soft: la categoria sparisce dal picker ma le spese storiche
  // continuano a mostrarla.
  async archive(userPublicId: string, categoryPublicId: string) {
    const category = await this.assertOwned(userPublicId, categoryPublicId);

    const archived = await this.prisma.category.update({
      where: { id: category.id },
      data: { archived: true },
    });

    return this.toResponse(archived);
  }

  // Usata da ExpenseService: una spesa puo' usare solo una categoria globale
  // o una propria, e mai una archiviata.
  async assertUsable(userId: number, categoryPublicId: string) {
    const category = await this.prisma.category.findUnique({
      where: { publicId: categoryPublicId },
    });
    if (!category || category.archived) {
      throw new NotFoundException('Categoria non trovata');
    }
    if (category.ownerId !== null && category.ownerId !== userId) {
      throw new ForbiddenException('Categoria non disponibile');
    }
    return category;
  }

  private async getUser(userPublicId: string) {
    const user = await this.prisma.user.findUnique({
      where: { publicId: userPublicId },
    });
    if (!user) {
      throw new NotFoundException('Utente non trovato');
    }
    return user;
  }

  // Solo le categorie custom del chiamante sono modificabili: le
  // preconfigurate sono condivise da tutti e restano immutabili.
  private async assertOwned(userPublicId: string, categoryPublicId: string) {
    const user = await this.getUser(userPublicId);

    const category = await this.prisma.category.findUnique({
      where: { publicId: categoryPublicId },
    });
    if (!category) {
      throw new NotFoundException('Categoria non trovata');
    }
    if (category.ownerId !== user.id) {
      throw new ForbiddenException('Questa categoria non ti appartiene');
    }

    return category;
  }

  private toResponse(category: Category) {
    return {
      publicId: category.publicId,
      slug: category.slug,
      name: category.name,
      icon: category.icon,
      color: category.color,
      // Le custom si mostrano con `name`, le preconfigurate traducendo lo slug.
      isCustom: category.ownerId !== null,
      createdDate: category.createdDate,
    };
  }
}
