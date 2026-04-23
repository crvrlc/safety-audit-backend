const prisma = require('../config/db');
const { cloudinary } = require('../config/cloudinary');

// GET evidence for a finding
const getEvidenceByFinding = async (req, res) => {
  try {
    const evidence = await prisma.evidence.findMany({
      where: { findingId: parseInt(req.params.findingId) },
      include: {
        uploadedByUser: { select: { id: true, name: true } }
      }
    });
    res.json(evidence);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching evidence', error: err.message });
  }
};

// GET evidence for an audit response
const getEvidenceByResponse = async (req, res) => {
  try {
    const evidence = await prisma.evidence.findMany({
      where: { auditResponseId: parseInt(req.params.responseId) },
      include: {
        uploadedByUser: { select: { id: true, name: true } }
      }
    });
    res.json(evidence);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching evidence', error: err.message });
  }
};

// POST upload evidence for an audit response
const uploadResponseEvidence = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const evidence = await prisma.evidence.create({
      data: {
        fileUrl:        req.file.path,
        fileType:       req.file.mimetype,
        auditResponseId: parseInt(req.params.responseId),
        uploadedBy:     req.user.id
      }
    });
    res.status(201).json(evidence);
  } catch (err) {
    res.status(500).json({ message: 'Error uploading evidence', error: err.message });
  }
};

// POST upload evidence for a finding
const uploadFindingEvidence = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const evidence = await prisma.evidence.create({
      data: {
        fileUrl:    req.file.path,
        fileType:   req.file.mimetype,
        findingId:  parseInt(req.params.findingId),
        uploadedBy: req.user.id
      }
    });
    res.status(201).json(evidence);
  } catch (err) {
    res.status(500).json({ message: 'Error uploading evidence', error: err.message });
  }
};

// DELETE evidence
const deleteEvidence = async (req, res) => {
  try {
    const evidence = await prisma.evidence.findUnique({
      where: { id: parseInt(req.params.id) }
    });

    if (!evidence) return res.status(404).json({ message: 'Evidence not found' });

    // Delete from Cloudinary
    const publicId = evidence.fileUrl.split('/').pop().split('.')[0];
    await cloudinary.uploader.destroy(`safety-audit-is/${publicId}`);

    // Delete from DB
    await prisma.evidence.delete({ where: { id: parseInt(req.params.id) } });

    res.json({ message: 'Evidence deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting evidence', error: err.message });
  }
};

module.exports = {
  getEvidenceByFinding,
  getEvidenceByResponse,
  uploadResponseEvidence,
  uploadFindingEvidence,
  deleteEvidence
};